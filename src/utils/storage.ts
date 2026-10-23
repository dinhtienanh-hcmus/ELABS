import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Exam, CandidateAttempt } from '../types/exam';
import { sanitizeQuestion } from './texParser';

const EXAMS_KEY = 'azota_pro_exams_v1';
const ATTEMPTS_KEY = 'azota_pro_attempts_v1';
const ACTIVE_TAKERS_KEY = 'azota_pro_active_takers_v1';

// Legacy mock IDs to filter out so old mock exams never pollute the user's workspace
const LEGACY_MOCK_EXAM_IDS = new Set([
  'exam-elabs-2026-semi',
  'exam-elabs-2026-embed'
]);
const LEGACY_MOCK_ATTEMPT_IDS = new Set(['att-1', 'att-2', 'att-3']);

export interface ActiveTaker {
  sessionId: string;
  examId: string;
  fullName: string;
  candidateCode: string;
  className: string;
  startedAt: number;
  lastPing: number;
  answeredCount: number;
  totalQuestions: number;
  tabSwitchCount: number;
  isCurrentlyFullscreen?: boolean;
  isVirtual?: boolean;
}

function cleanForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function toSafeDocId(id: string): string {
  return String(id || 'doc').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function normalizeExam(exam: Exam): Exam {
  return {
    ...exam,
    id: toSafeDocId(exam.id),
    questions: Array.isArray(exam.questions)
      ? exam.questions.map((q) => sanitizeQuestion(q))
      : []
  };
}

export function loadExams(): Exam[] {
  try {
    const raw = localStorage.getItem(EXAMS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(
          (exam: Exam) => exam && exam.id && !LEGACY_MOCK_EXAM_IDS.has(exam.id)
        );
        return filtered.map(normalizeExam);
      }
    }
  } catch (e) {
    console.error('Failed to load exams from storage', e);
  }
  return [];
}

export function saveExamsLocalOnly(exams: Exam[]): void {
  try {
    const cleaned = exams
      .filter((e) => e && e.id && !LEGACY_MOCK_EXAM_IDS.has(e.id))
      .map(normalizeExam);
    localStorage.setItem(EXAMS_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.error('Failed to save exams locally', e);
  }
}

export function saveExams(exams: Exam[]): void {
  saveExamsLocalOnly(exams);
  // Also push all exams in the array to Cloud Firestore
  exams.forEach((exam) => {
    if (exam && exam.id && !LEGACY_MOCK_EXAM_IDS.has(exam.id)) {
      saveExamToCloud(exam).catch((err) =>
        console.error('Background cloud exam save failed:', err)
      );
    }
  });
}

export async function saveExamToCloud(exam: Exam): Promise<void> {
  const normalized = normalizeExam(exam);
  const docId = toSafeDocId(normalized.id);
  try {
    await setDoc(doc(db, 'exams', docId), cleanForFirestore(normalized));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `exams/${docId}`);
    throw error;
  }
}

export async function deleteExamFromCloud(examId: string): Promise<void> {
  const docId = toSafeDocId(examId);
  try {
    await deleteDoc(doc(db, 'exams', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `exams/${docId}`);
  }
}

export function loadAttempts(): CandidateAttempt[] {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (a: CandidateAttempt) => a && a.id && !LEGACY_MOCK_ATTEMPT_IDS.has(a.id)
        );
      }
    }
  } catch (e) {
    console.error('Failed to load attempts', e);
  }
  return [];
}

export function saveAttemptsLocalOnly(attempts: CandidateAttempt[]): void {
  try {
    const filtered = attempts.filter(
      (a) => a && a.id && !LEGACY_MOCK_ATTEMPT_IDS.has(a.id)
    );
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to save attempts locally', e);
  }
}

export function saveAttempts(attempts: CandidateAttempt[]): void {
  saveAttemptsLocalOnly(attempts);
  attempts.forEach((att) => {
    if (att && att.id && !LEGACY_MOCK_ATTEMPT_IDS.has(att.id)) {
      const docId = toSafeDocId(att.id);
      setDoc(
        doc(db, 'attempts', docId),
        cleanForFirestore({ ...att, id: docId, examId: toSafeDocId(att.examId) })
      ).catch((error) =>
        handleFirestoreError(error, OperationType.WRITE, `attempts/${docId}`)
      );
    }
  });
}

export function saveAttempt(attempt: CandidateAttempt): void {
  const docId = toSafeDocId(attempt.id);
  const normalizedAttempt: CandidateAttempt = {
    ...attempt,
    id: docId,
    examId: toSafeDocId(attempt.examId)
  };

  try {
    const existing = loadAttempts();
    const idx = existing.findIndex((a) => a.id === normalizedAttempt.id);
    if (idx >= 0) {
      existing[idx] = normalizedAttempt;
    } else {
      existing.unshift(normalizedAttempt);
    }
    saveAttemptsLocalOnly(existing);
  } catch (e) {
    console.error('Failed to save attempt locally', e);
  }

  const payload = cleanForFirestore(normalizedAttempt);
  const writeWithRetry = async (retriesLeft: number, delayMs: number): Promise<void> => {
    try {
      await setDoc(doc(db, 'attempts', docId), payload);
    } catch (error) {
      if (retriesLeft > 0) {
        await new Promise((r) => setTimeout(r, delayMs + Math.random() * 400));
        return writeWithRetry(retriesLeft - 1, delayMs * 2);
      }
      handleFirestoreError(error, OperationType.WRITE, `attempts/${docId}`);
    }
  };

  writeWithRetry(4, 600);
}

export async function clearExamAttemptsFromCloud(
  examId: string,
  currentAttempts: CandidateAttempt[]
): Promise<void> {
  const targetExamId = toSafeDocId(examId);
  const toDelete = currentAttempts.filter(
    (a) => toSafeDocId(a.examId) === targetExamId
  );
  await Promise.all(
    toDelete.map(async (att) => {
      const docId = toSafeDocId(att.id);
      try {
        await deleteDoc(doc(db, 'attempts', docId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `attempts/${docId}`);
      }
    })
  );
}

export function resetAllStorageData(): void {
  try {
    localStorage.setItem(EXAMS_KEY, JSON.stringify([]));
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify([]));
    localStorage.setItem(ACTIVE_TAKERS_KEY, JSON.stringify([]));
  } catch (e) {
    console.error('Failed to reset storage data', e);
  }

  // Also clear all documents in Firestore collections
  (async () => {
    try {
      const [examsSnap, attemptsSnap, takersSnap] = await Promise.all([
        getDocs(collection(db, 'exams')),
        getDocs(collection(db, 'attempts')),
        getDocs(collection(db, 'activeTakers'))
      ]);
      const batch = writeBatch(db);
      examsSnap.forEach((d) => batch.delete(d.ref));
      attemptsSnap.forEach((d) => batch.delete(d.ref));
      takersSnap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'resetAll');
    }
  })();
}

export function saveActiveTakerPing(taker: ActiveTaker): void {
  const safeSessionId = toSafeDocId(taker.sessionId);
  const normalizedTaker: ActiveTaker = {
    ...taker,
    sessionId: safeSessionId,
    examId: toSafeDocId(taker.examId)
  };

  try {
    const takers = loadActiveTakers();
    const idx = takers.findIndex((t) => t.sessionId === safeSessionId);
    if (idx >= 0) {
      takers[idx] = normalizedTaker;
    } else {
      takers.push(normalizedTaker);
    }
    const now = Date.now();
    const valid = takers.filter((t) => now - t.lastPing < 180000);
    localStorage.setItem(ACTIVE_TAKERS_KEY, JSON.stringify(valid));
  } catch (e) {
    console.error('Failed to update active taker ping locally', e);
  }

  setDoc(
    doc(db, 'activeTakers', safeSessionId),
    cleanForFirestore(normalizedTaker)
  ).catch((error) =>
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `activeTakers/${safeSessionId}`
    )
  );
}

export function removeActiveTaker(sessionId: string): void {
  const safeSessionId = toSafeDocId(sessionId);
  try {
    const takers = loadActiveTakers();
    const filtered = takers.filter((t) => t.sessionId !== safeSessionId);
    localStorage.setItem(ACTIVE_TAKERS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to remove active taker locally', e);
  }

  deleteDoc(doc(db, 'activeTakers', safeSessionId)).catch((error) =>
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `activeTakers/${safeSessionId}`
    )
  );
}

export function loadActiveTakers(): ActiveTaker[] {
  try {
    const raw = localStorage.getItem(ACTIVE_TAKERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const now = Date.now();
        return parsed.filter((t: ActiveTaker) => now - t.lastPing < 180000);
      }
    }
  } catch (e) {
    console.error('Failed to load active takers', e);
  }
  return [];
}

/**
 * Forces uploading all local exams & attempts to Firestore
 */
export async function forceSyncAllToCloud(
  exams: Exam[],
  attempts: CandidateAttempt[]
): Promise<void> {
  await Promise.all([
    ...exams
      .filter((e) => e && e.id && !LEGACY_MOCK_EXAM_IDS.has(e.id))
      .map((exam) => saveExamToCloud(exam)),
    ...attempts
      .filter((a) => a && a.id && !LEGACY_MOCK_ATTEMPT_IDS.has(a.id))
      .map(async (att) => {
        const docId = toSafeDocId(att.id);
        await setDoc(
          doc(db, 'attempts', docId),
          cleanForFirestore({
            ...att,
            id: docId,
            examId: toSafeDocId(att.examId)
          })
        );
      })
  ]);
}

/**
 * Real-time subscription to `/exams` in Firestore.
 * Automatically migrates any local custom exams (e.g. ELABS-SANG) to Firestore if missing on the cloud!
 */
export function subscribeToCloudExams(
  onUpdate: (exams: Exam[]) => void,
  onSyncStatus?: (status: 'syncing' | 'synced' | 'error') => void
): () => void {
  onSyncStatus?.('syncing');
  let hasCheckedLocalMigration = false;

  const unsubscribe = onSnapshot(
    collection(db, 'exams'),
    async (snapshot) => {
      const cloudExams: Exam[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Exam;
        if (data && data.id && !LEGACY_MOCK_EXAM_IDS.has(data.id)) {
          cloudExams.push(normalizeExam(data));
        } else if (data && LEGACY_MOCK_EXAM_IDS.has(data.id)) {
          // Clean up any legacy mock exam if present
          deleteDoc(docSnap.ref).catch(() => {});
        }
      });

      // Auto-migrate local custom exams on initial snapshot if this browser has local exams not yet in Firestore
      if (!hasCheckedLocalMigration) {
        hasCheckedLocalMigration = true;
        const localExams = loadExams();
        const cloudIds = new Set(cloudExams.map((e) => e.id));
        const missingInCloud = localExams.filter((le) => !cloudIds.has(le.id));

        if (missingInCloud.length > 0) {
          try {
            await Promise.all(
              missingInCloud.map((exam) => saveExamToCloud(exam))
            );
            // The next snapshot will immediately fire with the merged exams
            return;
          } catch (e) {
            console.error('Auto-migration of local exams failed:', e);
          }
        }
      }

      // Sort by createdAt descending
      cloudExams.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      saveExamsLocalOnly(cloudExams);
      onUpdate(cloudExams);
      onSyncStatus?.('synced');
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'exams');
      onSyncStatus?.('error');
    }
  );

  return unsubscribe;
}

/**
 * Real-time subscription to `/attempts` in Firestore.
 */
export function subscribeToCloudAttempts(
  onUpdate: (attempts: CandidateAttempt[]) => void
): () => void {
  let hasCheckedLocalAttemptsMigration = false;

  return onSnapshot(
    collection(db, 'attempts'),
    async (snapshot) => {
      const cloudAttempts: CandidateAttempt[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CandidateAttempt;
        if (data && data.id && !LEGACY_MOCK_ATTEMPT_IDS.has(data.id)) {
          cloudAttempts.push(data);
        }
      });

      if (!hasCheckedLocalAttemptsMigration) {
        hasCheckedLocalAttemptsMigration = true;
        const localAttempts = loadAttempts();
        const cloudIds = new Set(cloudAttempts.map((a) => a.id));
        const missingInCloud = localAttempts.filter(
          (la) => !cloudIds.has(toSafeDocId(la.id))
        );
        if (missingInCloud.length > 0) {
          saveAttempts(missingInCloud);
        }
      }

      cloudAttempts.sort(
        (a, b) =>
          (b.submittedAt || b.startedAt || 0) -
          (a.submittedAt || a.startedAt || 0)
      );
      saveAttemptsLocalOnly(cloudAttempts);
      onUpdate(cloudAttempts);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attempts');
    }
  );
}

/**
 * Real-time subscription to `/activeTakers` in Firestore.
 */
export function subscribeToCloudActiveTakers(
  onUpdate: (takers: ActiveTaker[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'activeTakers'),
    (snapshot) => {
      const now = Date.now();
      const active: ActiveTaker[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ActiveTaker;
        if (data && data.sessionId && now - data.lastPing < 180000) {
          active.push(data);
        }
      });
      try {
        localStorage.setItem(ACTIVE_TAKERS_KEY, JSON.stringify(active));
      } catch {
        // ignore
      }
      onUpdate(active);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activeTakers');
    }
  );
}
