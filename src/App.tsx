import React, { useState, useEffect, useCallback } from 'react';
import { Exam, CandidateInfo, CandidateAttempt } from './types/exam';
import {
  loadExams,
  saveExams,
  saveExamToCloud,
  deleteExamFromCloud,
  loadAttempts,
  saveAttemptsLocalOnly,
  saveAttempt,
  clearExamAttemptsFromCloud,
  loadActiveTakers,
  resetAllStorageData,
  subscribeToCloudExams,
  subscribeToCloudAttempts,
  subscribeToCloudActiveTakers,
  forceSyncAllToCloud
} from './utils/storage';
import { gradeAttempt } from './utils/scoring';
import { Navbar } from './components/Navbar';
import { ExamListOrJoinView } from './components/Candidate/ExamListOrJoinView';
import { CandidateEntryModal } from './components/Candidate/CandidateEntryModal';
import { ExamRoom } from './components/Candidate/ExamRoom';
import { ExamResultView } from './components/Candidate/ExamResultView';
import { BtcDashboard } from './components/Btc/BtcDashboard';
import { BtcExamEditor } from './components/Btc/BtcExamEditor';
import { BtcLiveMonitor } from './components/Btc/BtcLiveMonitor';
import { BtcSubmissionsView } from './components/Btc/BtcSubmissionsView';
import { BtcLoginModal } from './components/Btc/BtcLoginModal';
import { auth, signOut, onAuthStateChanged, isUserAdmin } from './firebase';

export default function App() {
  // Global Data State
  const [exams, setExams] = useState<Exam[]>(() => loadExams());
  const [attempts, setAttempts] = useState<CandidateAttempt[]>(() => loadAttempts());
  const [activeCount, setActiveCount] = useState<number>(0);
  const [cloudStatus, setCloudStatus] = useState<'syncing' | 'synced' | 'error'>('syncing');

  // App Navigation & Session State
  const [currentTab, setCurrentTab] = useState<'candidate' | 'btc'>('candidate');
  const [isBtcLoggedIn, setIsBtcLoggedIn] = useState<boolean>(false);
  const [showBtcLoginModal, setShowBtcLoginModal] = useState<boolean>(false);

  // Sync auth state with BTC session
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (isUserAdmin(user)) {
        setIsBtcLoggedIn(true);
      }
    });
    return () => unsubAuth();
  }, []);

  const handleBtcLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Logout error:', e);
    }
    setIsBtcLoggedIn(false);
    setCurrentTab('candidate');
  };

  // Candidate Journey State
  const [selectedExamForEntry, setSelectedExamForEntry] = useState<Exam | null>(null);
  const [activeExamSession, setActiveExamSession] = useState<{
    exam: Exam;
    candidateInfo: CandidateInfo;
  } | null>(null);
  const [latestSubmittedAttempt, setLatestSubmittedAttempt] = useState<{
    exam: Exam;
    attempt: CandidateAttempt;
  } | null>(null);

  // BTC Modals & Views State
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [isCreatingNewExam, setIsCreatingNewExam] = useState<boolean>(false);
  const [liveMonitorExam, setLiveMonitorExam] = useState<Exam | null>(null);
  const [submissionsExam, setSubmissionsExam] = useState<Exam | null>(null);

  // Subscribe to Cloud Firestore Exams (lightweight: 1-2 docs per student)
  useEffect(() => {
    const unsubExams = subscribeToCloudExams(
      (cloudExams) => {
        setExams(cloudExams);
      },
      (status) => {
        setCloudStatus(status);
      }
    );

    return () => {
      unsubExams();
    };
  }, []);

  // Only subscribe to Attempts & ActiveTakers when BTC is logged in (prevents 100x read fan-out on student devices!)
  useEffect(() => {
    if (!isBtcLoggedIn) return;

    const unsubAttempts = subscribeToCloudAttempts((cloudAttempts) => {
      setAttempts(cloudAttempts);
    });

    const unsubActiveTakers = subscribeToCloudActiveTakers((activeTakers) => {
      setActiveCount(activeTakers.length);
    });

    const interval = setInterval(() => {
      const active = loadActiveTakers();
      setActiveCount(active.length);
    }, 5000);

    return () => {
      unsubAttempts();
      unsubActiveTakers();
      clearInterval(interval);
    };
  }, [isBtcLoggedIn]);

  // Persist exams changes
  const handleUpdateExams = useCallback((updated: Exam[]) => {
    setExams(updated);
    saveExams(updated);
  }, []);

  // Check URL query parameters (e.g. ?code=ELABS-SANG or ?btc=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    const btcParam = params.get('btc');

    if (codeParam) {
      const found = exams.find((e) => e.code.toUpperCase() === codeParam.toUpperCase());
      if (found) {
        setSelectedExamForEntry(found);
      }
    } else if (btcParam === '1') {
      setShowBtcLoginModal(true);
    }
  }, [exams]);

  // Candidate Journey Handlers
  const handleStartExam = (candidateInfo: CandidateInfo) => {
    if (!selectedExamForEntry) return;
    setActiveExamSession({
      exam: selectedExamForEntry,
      candidateInfo
    });
    setSelectedExamForEntry(null);
  };

  const handleSubmitExam = (
    answers: Record<string, string>,
    timeSpentSeconds: number,
    tabSwitchLogs: { timestamp: number; message: string }[],
    isDisqualified: boolean = false,
    disqualificationReason?: string
  ) => {
    if (!activeExamSession) return;
    const { exam, candidateInfo } = activeExamSession;
    const tabSwitchCount = tabSwitchLogs.length;

    const gradedAttempt = gradeAttempt(
      exam,
      answers,
      timeSpentSeconds,
      candidateInfo,
      tabSwitchCount,
      tabSwitchLogs,
      isDisqualified,
      disqualificationReason
    );

    saveAttempt(gradedAttempt);
    setAttempts((prev) => [gradedAttempt, ...prev.filter((a) => a.id !== gradedAttempt.id)]);
    setLatestSubmittedAttempt({ exam, attempt: gradedAttempt });
    setActiveExamSession(null);
  };

  // BTC Actions
  const handleSaveExamFromEditor = (savedExam: Exam) => {
    const existingIdx = exams.findIndex((e) => e.id === savedExam.id);
    let nextExams: Exam[];
    if (existingIdx >= 0) {
      nextExams = [...exams];
      nextExams[existingIdx] = savedExam;
    } else {
      nextExams = [savedExam, ...exams];
    }
    setExams(nextExams);
    saveExams(nextExams);
    setIsCreatingNewExam(false);
    setEditingExam(null);
  };

  const handleDeleteExam = (examId: string) => {
    const nextExams = exams.filter((e) => e.id !== examId);
    const nextAttempts = attempts.filter((a) => a.examId !== examId);
    setExams(nextExams);
    setAttempts(nextAttempts);
    saveAttemptsLocalOnly(nextAttempts);
    deleteExamFromCloud(examId);
    clearExamAttemptsFromCloud(examId, attempts);
  };

  const handleClearExamAttempts = (examId: string) => {
    const nextAttempts = attempts.filter((a) => a.examId !== examId);
    setAttempts(nextAttempts);
    saveAttemptsLocalOnly(nextAttempts);
    clearExamAttemptsFromCloud(examId, attempts);
  };

  const handleResetAllData = () => {
    resetAllStorageData();
    setExams([]);
    setAttempts([]);
    setActiveCount(0);
  };

  const handleToggleExamStatus = (examId: string) => {
    const nextExams = exams.map((e) => {
      if (e.id === examId) {
        const updated: Exam = {
          ...e,
          status: (e.status === 'closed' ? 'published' : 'closed') as 'published' | 'closed',
          updatedAt: Date.now()
        };
        saveExamToCloud(updated).catch(() => {});
        return updated;
      }
      return e;
    });
    handleUpdateExams(nextExams);
  };

  const handleForceSyncCloud = async () => {
    setCloudStatus('syncing');
    try {
      await forceSyncAllToCloud(exams, attempts);
      setCloudStatus('synced');
    } catch {
      setCloudStatus('error');
    }
  };

  const handleImportExamsJson = (importedExams: Exam[]) => {
    const map = new Map<string, Exam>();
    exams.forEach((e) => map.set(e.id, e));
    importedExams.forEach((e) => map.set(e.id, e));
    const merged = Array.from(map.values()).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
    handleUpdateExams(merged);
  };

  const handleSelectTab = (tab: 'candidate' | 'btc') => {
    setLatestSubmittedAttempt(null);
    setCurrentTab(tab);
  };

  // IF CANDIDATE IS CURRENTLY IN EXAM ROOM (Zero distraction, full exam environment)
  if (activeExamSession) {
    return (
      <ExamRoom
        exam={activeExamSession.exam}
        candidateInfo={activeExamSession.candidateInfo}
        onSubmitExam={handleSubmitExam}
        onExit={() => setActiveExamSession(null)}
      />
    );
  }

  // IF SHOWING SUBMISSION RESULTS
  if (latestSubmittedAttempt && currentTab === 'candidate') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar
          currentTab={currentTab}
          isBtcLoggedIn={isBtcLoggedIn}
          onSelectTab={handleSelectTab}
          onOpenBtcLogin={() => setShowBtcLoginModal(true)}
          onBtcLogout={handleBtcLogout}
        />
        <main className="flex-1 py-4">
          <ExamResultView
            exam={latestSubmittedAttempt.exam}
            attempt={latestSubmittedAttempt.attempt}
            onRetake={() => {
              setSelectedExamForEntry(latestSubmittedAttempt.exam);
              setLatestSubmittedAttempt(null);
            }}
            onBackToHome={() => setLatestSubmittedAttempt(null)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        isBtcLoggedIn={isBtcLoggedIn}
        onSelectTab={handleSelectTab}
        onOpenBtcLogin={() => setShowBtcLoginModal(true)}
        onBtcLogout={handleBtcLogout}
      />

      {/* Main View Switcher */}
      <main className="flex-1">
        {currentTab === 'candidate' ? (
          /* CANDIDATE PORTAL */
          <ExamListOrJoinView
            exams={exams}
            isLoading={cloudStatus === 'syncing' && exams.length === 0}
            onSelectExam={(exam) => setSelectedExamForEntry(exam)}
          />
        ) : (
          /* BTC / TEACHER PORTAL */
          <div className="py-2">
            {isCreatingNewExam || editingExam ? (
              <BtcExamEditor
                initialExam={editingExam}
                onSave={handleSaveExamFromEditor}
                onCancel={() => {
                  setIsCreatingNewExam(false);
                  setEditingExam(null);
                }}
              />
            ) : liveMonitorExam ? (
              <div className="max-w-6xl mx-auto px-4 py-6">
                <BtcLiveMonitor
                  exam={liveMonitorExam}
                  onClose={() => setLiveMonitorExam(null)}
                />
              </div>
            ) : submissionsExam ? (
              <div className="max-w-6xl mx-auto px-4 py-6">
                <BtcSubmissionsView
                  exam={submissionsExam}
                  allExams={exams}
                  attempts={attempts}
                  onClearExamAttempts={() => handleClearExamAttempts(submissionsExam.id)}
                  onClose={() => setSubmissionsExam(null)}
                />
              </div>
            ) : (
              <BtcDashboard
                exams={exams}
                attempts={attempts}
                activeCount={activeCount}
                cloudStatus={cloudStatus}
                onForceSyncCloud={handleForceSyncCloud}
                onImportExamsJson={handleImportExamsJson}
                onCreateExam={() => setIsCreatingNewExam(true)}
                onEditExam={(exam) => setEditingExam(exam)}
                onDeleteExam={handleDeleteExam}
                onResetAllData={handleResetAllData}
                onToggleExamStatus={handleToggleExamStatus}
                onOpenLiveMonitor={(exam) => setLiveMonitorExam(exam)}
                onOpenSubmissions={(exam) => setSubmissionsExam(exam)}
              />
            )}
          </div>
        )}
      </main>

      {/* Candidate Entry Form Modal */}
      {selectedExamForEntry && (
        <CandidateEntryModal
          exam={selectedExamForEntry}
          isOpen={true}
          attempts={attempts}
          onClose={() => setSelectedExamForEntry(null)}
          onStartExam={handleStartExam}
        />
      )}

      {/* BTC Login Modal */}
      <BtcLoginModal
        isOpen={showBtcLoginModal}
        onClose={() => setShowBtcLoginModal(false)}
        onLoginSuccess={() => {
          setIsBtcLoggedIn(true);
          setShowBtcLoginModal(false);
          setCurrentTab('btc');
        }}
      />
    </div>
  );
}
