import React, { useState, useRef } from 'react';
import {
  Exam,
  ExamSection,
  Question,
  CandidateFieldConfig,
  DEFAULT_CANDIDATE_FIELDS,
  TEAM_CANDIDATE_FIELDS,
  getExamCandidateFields
} from '../../types/exam';
import { parseTexExam, distributePointsEvenly, sanitizeQuestion, SAMPLE_TEX_EXAM } from '../../utils/texParser';
import { MathView } from '../MathView';
import {
  FileText,
  Sliders,
  ShieldAlert,
  Plus,
  Trash2,
  Upload,
  Download,
  Check,
  RefreshCw,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  UserCheck
} from 'lucide-react';

interface BtcExamEditorProps {
  initialExam?: Exam | null;
  onSave: (exam: Exam) => void;
  onCancel: () => void;
}

const DEFAULT_SECTIONS: ExamSection[] = [
  {
    id: 'part_1',
    title: 'Phần 1',
    description: 'Câu hỏi chính (Tính điểm xếp hạng)',
    totalPoints: 10,
    isTieBreaker: false
  },
  {
    id: 'part_2',
    title: 'Phần 2',
    description: 'Câu hỏi phụ (Không tính điểm - chỉ xét khi bằng điểm)',
    totalPoints: 0,
    isTieBreaker: true
  }
];

function normalizeSectionsWithPoints(
  rawSections: ExamSection[] | undefined,
  examTotalPoints: number = 10
): ExamSection[] {
  if (!rawSections || rawSections.length === 0) {
    return DEFAULT_SECTIONS.map((s, idx) =>
      idx === 0 ? { ...s, totalPoints: examTotalPoints } : { ...s }
    );
  }
  return rawSections.map((sec, idx) => {
    const isTie =
      typeof sec.isTieBreaker === 'boolean'
        ? sec.isTieBreaker
        : idx > 0 && sec.totalPoints === undefined;
    const pts = isTie
      ? 0
      : typeof sec.totalPoints === 'number'
      ? sec.totalPoints
      : idx === 0
      ? examTotalPoints
      : 0;
    return {
      ...sec,
      isTieBreaker: isTie,
      totalPoints: pts
    };
  });
}

function distributeQuestionsBySections(
  rawList: Question[],
  currentSections: ExamSection[],
  fallbackTotalPoints: number = 10
): Question[] {
  if (rawList.length === 0) return [];
  const fallbackSecId = currentSections[0]?.id || 'part_1';
  const sectionIds = new Set(currentSections.map((s) => s.id));

  const validList = rawList.map((q) => ({
    ...q,
    sectionId: q.sectionId && sectionIds.has(q.sectionId) ? q.sectionId : fallbackSecId
  }));

  const result: Question[] = [];
  currentSections.forEach((sec, secIdx) => {
    const secQuestions = validList.filter((q) => q.sectionId === sec.id);
    if (secQuestions.length === 0) return;

    const isTie = Boolean(sec.isTieBreaker || sec.totalPoints === 0);
    const secPoints = isTie
      ? 0
      : typeof sec.totalPoints === 'number'
      ? sec.totalPoints
      : secIdx === 0
      ? fallbackTotalPoints
      : 0;

    const distributed = distributePointsEvenly(secQuestions, secPoints);
    result.push(...distributed);
  });

  return result.map((q, idx) => ({
    ...q,
    number: idx + 1
  }));
}

export const BtcExamEditor: React.FC<BtcExamEditorProps> = ({
  initialExam,
  onSave,
  onCancel
}) => {
  const [activeTab, setActiveTab] = useState<'tex' | 'questions' | 'settings' | 'candidate-form'>('tex');

  // Exam Meta State
  const [title, setTitle] = useState(
    initialExam?.title || 'CUỘC THI HỌC THUẬT ELABS LẦN THỨ XIX - NĂM 2026'
  );
  const [code, setCode] = useState(
    initialExam?.code || `ELABS-${Math.floor(100 + Math.random() * 900)}`
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(initialExam?.durationMinutes || 45);
  const [totalPoints, setTotalPoints] = useState<number>(initialExam?.totalPoints || 10);
  const [password, setPassword] = useState(initialExam?.password || '');

  // Sections State (Phần 1, Phần 2, ...)
  const [sections, setSections] = useState<ExamSection[]>(() =>
    normalizeSectionsWithPoints(initialExam?.sections, initialExam?.totalPoints || 10)
  );

  // Active section in Tab 1 (TeX Import) and Tab 2 (Questions filter)
  const [targetSectionId, setTargetSectionId] = useState<string>(() => {
    const norm = normalizeSectionsWithPoints(initialExam?.sections, initialExam?.totalPoints || 10);
    return norm[0].id;
  });
  const [questionFilterSectionId, setQuestionFilterSectionId] = useState<string>('all');

  // Settings State
  const [sequentialParts, setSequentialParts] = useState(initialExam?.settings.sequentialParts ?? true);
  const [shuffleQuestions, setShuffleQuestions] = useState(initialExam?.settings.shuffleQuestions ?? false);
  const [shuffleOptions, setShuffleOptions] = useState(initialExam?.settings.shuffleOptions ?? false);
  const [requireFullscreen, setRequireFullscreen] = useState(initialExam?.settings.requireFullscreen ?? true);
  const [strictFullscreenLock, setStrictFullscreenLock] = useState(initialExam?.settings.strictFullscreenLock ?? true);
  const [trackTabSwitch, setTrackTabSwitch] = useState(initialExam?.settings.trackTabSwitch ?? true);
  const [maxTabSwitches, setMaxTabSwitches] = useState(initialExam?.settings.maxTabSwitches ?? 3);
  const [autoSubmitOnMaxViolations, setAutoSubmitOnMaxViolations] = useState(initialExam?.settings.autoSubmitOnMaxViolations ?? true);
  const [showResultImmediately, setShowResultImmediately] = useState(initialExam?.settings.showResultImmediately ?? true);
  const [showExplanations, setShowExplanations] = useState(initialExam?.settings.showExplanations ?? true);
  const [maxAttempts, setMaxAttempts] = useState<number>(initialExam?.settings.maxAttempts ?? 1);

  // Candidate Entry Form Customization State
  const [candidateFields, setCandidateFields] = useState<CandidateFieldConfig[]>(() =>
    getExamCandidateFields(initialExam).map((f) => ({ ...f }))
  );
  const [allowDemoFill, setAllowDemoFill] = useState<boolean>(
    initialExam?.settings.allowDemoFill ?? false
  );
  const [entryRuleNote, setEntryRuleNote] = useState<string>(
    initialExam?.settings.entryRuleNote ||
      'Hệ thống tự động bật chế độ Toàn màn hình (Fullscreen) và giám sát chuyển tab trong suốt thời gian làm bài. Đề thi tự động nộp khi hết giờ.'
  );

  const [newOptionInputs, setNewOptionInputs] = useState<Record<string, string>>({});

  const handleUpdateCandidateField = (
    fieldId: string,
    partial: Partial<CandidateFieldConfig>
  ) => {
    setCandidateFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) {
          // If setting a new isTeamGroupField = true, uncheck others so there is one clear primary team group field
          if (partial.isTeamGroupField === true) {
            return { ...f, isTeamGroupField: false };
          }
          return f;
        }
        const next = { ...f, ...partial };
        if (partial.type === 'select' && (!next.options || next.options.length === 0)) {
          next.options = [
            'Đội 01 - ELABS Alpha',
            'Đội 02 - ELABS Beta',
            'Đội 03 - ELABS Gamma',
            'Đội 04 - ELABS Delta',
            'Đội 05 - ELABS Omega'
          ];
          if (next.isTeamGroupField === undefined) {
            next.isTeamGroupField = true;
          }
        }
        return next;
      })
    );
  };

  const handleMoveCandidateField = (index: number, direction: 'up' | 'down') => {
    setCandidateFields((prev) => {
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleAddCandidateField = (fieldType: 'text' | 'select' = 'text') => {
    const newId = `custom_${Date.now()}`;
    setCandidateFields((prev) => [
      ...prev,
      fieldType === 'select'
        ? {
            id: newId,
            label: 'Chọn Đội thi',
            placeholder: '-- Bấm vào đây để chọn Đội thi --',
            required: true,
            enabled: true,
            isHalfWidth: false,
            type: 'select',
            isTeamGroupField: true,
            options: [
              'Đội 01 - ELABS Alpha',
              'Đội 02 - ELABS Beta',
              'Đội 03 - ELABS Gamma',
              'Đội 04 - ELABS Delta',
              'Đội 05 - ELABS Omega'
            ]
          }
        : {
            id: newId,
            label: `Thông tin bổ sung ${prev.length + 1}`,
            placeholder: 'Nhập nội dung...',
            required: false,
            enabled: true,
            isHalfWidth: false,
            type: 'text'
          }
    ]);
  };

  const handleDeleteCandidateField = (fieldId: string) => {
    setCandidateFields((prev) => prev.filter((f) => f.id !== fieldId));
  };

  // Per-section TeX source buffer so BTC can import TeX into Phần 1, then switch to Phần 2 and import TeX for Phần 2 seamlessly
  const [texBySection, setTexBySection] = useState<Record<string, string>>({});
  const currentTexSource = texBySection[targetSectionId] || '';

  const setCurrentTexSource = (val: string) => {
    setTexBySection((prev) => ({
      ...prev,
      [targetSectionId]: val
    }));
  };

  const [texParseSuccessMsg, setTexParseSuccessMsg] = useState('');
  const [texErrorMsg, setTexErrorMsg] = useState('');
  const editorFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExportCurrentExamJson = () => {
    const currentExamSnapshot: Exam = {
      id: initialExam?.id || `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      code: code.trim().toUpperCase() || 'ELABS-2026',
      title: title.trim() || 'Đề thi trắc nghiệm ELABS',
      sections,
      durationMinutes: Number(durationMinutes) || 45,
      totalPoints: Number(totalPoints) || 10,
      pointDistribution: 'equal',
      password: password.trim(),
      settings: {
        sequentialParts,
        shuffleQuestions,
        shuffleOptions,
        requireFullscreen,
        strictFullscreenLock,
        trackTabSwitch,
        maxTabSwitches: Number(maxTabSwitches) || 3,
        autoSubmitOnMaxViolations,
        showResultImmediately,
        showExplanations,
        allowReviewAnswers: true,
        candidateFields,
        allowDemoFill,
        entryRuleNote: entryRuleNote.trim(),
        maxAttempts: Number(maxAttempts) >= 0 ? Number(maxAttempts) : 1
      },
      questions,
      status: initialExam?.status || 'published',
      createdAt: initialExam?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    const dataStr = JSON.stringify(currentExamSnapshot, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Exam_${(currentExamSnapshot.code || 'ELABS').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCurrentExamJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || '{}'));
        if (parsed && Array.isArray(parsed.questions)) {
          if (parsed.code) setCode(parsed.code);
          if (parsed.title) setTitle(parsed.title);
          if (parsed.durationMinutes) setDurationMinutes(parsed.durationMinutes);
          if (parsed.totalPoints) setTotalPoints(parsed.totalPoints);
          if (parsed.password) setPassword(parsed.password);
          if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
            setSections(parsed.sections);
          }
          if (parsed.settings) {
            if (typeof parsed.settings.sequentialParts === 'boolean') setSequentialParts(parsed.settings.sequentialParts);
            if (typeof parsed.settings.shuffleQuestions === 'boolean') setShuffleQuestions(parsed.settings.shuffleQuestions);
            if (typeof parsed.settings.shuffleOptions === 'boolean') setShuffleOptions(parsed.settings.shuffleOptions);
            if (typeof parsed.settings.requireFullscreen === 'boolean') setRequireFullscreen(parsed.settings.requireFullscreen);
            if (typeof parsed.settings.strictFullscreenLock === 'boolean') setStrictFullscreenLock(parsed.settings.strictFullscreenLock);
            if (typeof parsed.settings.trackTabSwitch === 'boolean') setTrackTabSwitch(parsed.settings.trackTabSwitch);
            if (typeof parsed.settings.maxTabSwitches === 'number') setMaxTabSwitches(parsed.settings.maxTabSwitches);
            if (typeof parsed.settings.autoSubmitOnMaxViolations === 'boolean') setAutoSubmitOnMaxViolations(parsed.settings.autoSubmitOnMaxViolations);
            if (typeof parsed.settings.showResultImmediately === 'boolean') setShowResultImmediately(parsed.settings.showResultImmediately);
            if (typeof parsed.settings.showExplanations === 'boolean') setShowExplanations(parsed.settings.showExplanations);
            if (Array.isArray(parsed.settings.candidateFields)) setCandidateFields(parsed.settings.candidateFields);
            if (typeof parsed.settings.allowDemoFill === 'boolean') setAllowDemoFill(parsed.settings.allowDemoFill);
            if (typeof parsed.settings.entryRuleNote === 'string') setEntryRuleNote(parsed.settings.entryRuleNote);
            if (typeof parsed.settings.maxAttempts === 'number') setMaxAttempts(parsed.settings.maxAttempts);
          }
          setQuestions(parsed.questions);
          setTexParseSuccessMsg(`Đã nạp thành công đề "${parsed.title || parsed.code}" gồm ${parsed.questions.length} câu hỏi từ file JSON!`);
          setTexErrorMsg('');
        } else {
          setTexErrorMsg('File JSON không đúng cấu trúc đề thi (thiếu danh sách questions).');
        }
      } catch {
        setTexErrorMsg('Không thể đọc file JSON này. Vui lòng kiểm tra lại định dạng tệp!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Questions array: start empty for new exams, or initialExam's sanitized questions when editing
  const [questions, setQuestions] = useState<Question[]>(() => {
    const normSecs = normalizeSectionsWithPoints(initialExam?.sections, initialExam?.totalPoints || 10);
    const defaultSecId = normSecs[0].id;
    const rawQs = (initialExam?.questions || []).map((q) => ({
      ...sanitizeQuestion(q),
      sectionId: q.sectionId || defaultSecId
    }));
    // Automatically fix any negative point bug or uninitialized section points
    const hasNegativeOrUnsetBySec =
      rawQs.some((q) => q.points < 0) ||
      (initialExam?.sections && initialExam.sections.some((s) => s.totalPoints === undefined));
    if (hasNegativeOrUnsetBySec) {
      return distributeQuestionsBySections(rawQs, normSecs, initialExam?.totalPoints || 10);
    }
    return rawQs;
  });

  // Helper to re-order questions by section order, re-number 1..N, and distribute points per section
  const normalizeAndDistributeQuestions = (
    rawList: Question[],
    currentSections: ExamSection[] = sections,
    pointsTotal: number = totalPoints
  ): Question[] => {
    return distributeQuestionsBySections(rawList, currentSections, pointsTotal);
  };

  // Sync total exam points from non-tiebreaker sections
  const syncTotalPointsFromSections = (nextSections: ExamSection[]) => {
    const sumMainPoints = nextSections.reduce(
      (acc, s) => acc + (s.isTieBreaker ? 0 : Number(s.totalPoints) || 0),
      0
    );
    if (sumMainPoints > 0) {
      setTotalPoints(+sumMainPoints.toFixed(2));
    }
    return sumMainPoints || totalPoints;
  };

  // Section management helpers
  const handleAddSection = () => {
    const nextIdx = sections.length + 1;
    const newSec: ExamSection = {
      id: `part_${Date.now()}_${nextIdx}`,
      title: `Phần ${nextIdx}`,
      description: 'Câu hỏi phụ (Không tính điểm - chỉ xét khi bằng điểm)',
      totalPoints: 0,
      isTieBreaker: true
    };
    const nextSections = [...sections, newSec];
    setSections(nextSections);
    setTargetSectionId(newSec.id);
    setTexParseSuccessMsg(`Đã thêm "${newSec.title}" (Mặc định là câu hỏi phụ 0đ - bạn có thể chỉnh điểm của phần ở bên dưới).`);
    setTexErrorMsg('');
  };

  const handleUpdateSection = (secId: string, partial: Partial<ExamSection>) => {
    const nextSections = sections.map((s) => {
      if (s.id !== secId) return s;
      const updated = { ...s, ...partial };
      if (partial.isTieBreaker === true) {
        updated.totalPoints = 0;
      } else if (partial.isTieBreaker === false && (!updated.totalPoints || updated.totalPoints <= 0)) {
        updated.totalPoints = 10;
      }
      return updated;
    });
    setSections(nextSections);
    const newTotal = syncTotalPointsFromSections(nextSections);

    // If points or tie-breaker status changed, immediately redistribute points for questions in this section
    if (partial.totalPoints !== undefined || partial.isTieBreaker !== undefined) {
      setQuestions((prev) => distributeQuestionsBySections(prev, nextSections, newTotal));
    }
  };

  const handleDeleteSection = (secId: string) => {
    if (sections.length <= 1) return;
    const remaining = sections.filter((s) => s.id !== secId);
    const fallbackId = remaining[0].id;
    setSections(remaining);
    const newTotal = syncTotalPointsFromSections(remaining);
    if (targetSectionId === secId) {
      setTargetSectionId(fallbackId);
    }
    if (questionFilterSectionId === secId) {
      setQuestionFilterSectionId('all');
    }
    // Move any questions in deleted section to fallback section
    const reassigned = questions.map((q) =>
      q.sectionId === secId ? { ...q, sectionId: fallbackId } : q
    );
    setQuestions(normalizeAndDistributeQuestions(reassigned, remaining, newTotal));
  };

  // Merge parsed questions into the currently selected section (`targetSectionId`)
  const applyParsedQuestionsToSection = (parsedForSection: Question[], sourceLabel: string) => {
    const targetSec = sections.find((s) => s.id === targetSectionId) || sections[0];
    const secId = targetSec.id;

    const taggedQuestions = parsedForSection.map((q) => ({
      ...q,
      sectionId: secId
    }));

    // Keep questions from other sections, replace questions of target section
    const otherSectionQuestions = questions.filter((q) => q.sectionId !== secId);
    const combined = normalizeAndDistributeQuestions(
      [...otherSectionQuestions, ...taggedQuestions],
      sections,
      totalPoints
    );

    setQuestions(combined);
    setTexErrorMsg('');
    setTexParseSuccessMsg(
      `Đã trích xuất ${taggedQuestions.length} câu hỏi vào "${targetSec.title}" (${targetSec.isTieBreaker ? 'Câu hỏi phụ - 0đ' : `${targetSec.totalPoints ?? 10}đ`}) ${sourceLabel}. Tổng đề thi hiện có: ${combined.length} câu.`
    );
  };

  // Image file upload for a specific question
  const handleQuestionImageUpload = (qId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        handleUpdateQuestion(qId, { imageUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Clipboard image paste handler (Ctrl+V) for a specific question
  const handleQuestionImagePaste = (qId: string, e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (dataUrl) {
            handleUpdateQuestion(qId, { imageUrl: dataUrl });
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  // File upload handler for .tex
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCurrentTexSource(content);
        const parsed = parseTexExam(content, totalPoints);
        if (parsed.length > 0) {
          applyParsedQuestionsToSection(parsed, `từ tệp "${file.name}"`);
        } else {
          setTexParseSuccessMsg('');
          setTexErrorMsg(
            `Đã đọc tệp "${file.name}" nhưng chưa tìm thấy câu hỏi hợp lệ. Hãy kiểm tra cú pháp \\begin{ex}...\\end{ex} hoặc Câu 1. ... A. B. C. D.`
          );
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleParseCurrentTex = () => {
    if (!currentTexSource.trim()) {
      setTexParseSuccessMsg('');
      setTexErrorMsg('Vui lòng dán mã TeX hoặc tải tệp .tex / .txt lên trước khi trích xuất!');
      return;
    }
    const parsed = parseTexExam(currentTexSource, totalPoints);
    if (parsed.length > 0) {
      applyParsedQuestionsToSection(parsed, '');
    } else {
      setTexParseSuccessMsg('');
      setTexErrorMsg(
        'Không tìm thấy định dạng câu hỏi hợp lệ trong mã TeX. Hãy kiểm tra lại môi trường \\begin{ex}...\\end{ex} hoặc Câu 1. ... A. B. C. D.'
      );
    }
  };

  const handleLoadSampleTex = () => {
    setCurrentTexSource(SAMPLE_TEX_EXAM);
    const parsed = parseTexExam(SAMPLE_TEX_EXAM, totalPoints);
    applyParsedQuestionsToSection(parsed, '(Đề mẫu TeX)');
  };

  const handleClearCurrentSectionQuestions = () => {
    const targetSec = sections.find((s) => s.id === targetSectionId) || sections[0];
    setCurrentTexSource('');
    const remaining = questions.filter((q) => q.sectionId !== targetSec.id);
    setQuestions(normalizeAndDistributeQuestions(remaining, sections, totalPoints));
    setTexParseSuccessMsg(`Đã xóa trắng mã TeX và câu hỏi của "${targetSec.title}".`);
    setTexErrorMsg('');
  };

  const handleClearAllTexAndQuestions = () => {
    setTexBySection({});
    setQuestions([]);
    setTexParseSuccessMsg('');
    setTexErrorMsg('');
  };

  const handleDistributePoints = () => {
    const newTotal = syncTotalPointsFromSections(sections);
    const updated = distributeQuestionsBySections(questions, sections, newTotal);
    setQuestions(updated);
  };

  // Add empty manual question
  const handleAddQuestion = (forSectionId?: string) => {
    const secId =
      forSectionId && forSectionId !== 'all'
        ? forSectionId
        : questionFilterSectionId !== 'all'
        ? questionFilterSectionId
        : sections[0]?.id || 'part_1';

    const newNum = questions.length + 1;
    const newQ: Question = {
      id: `q_man_${Date.now()}_${newNum}`,
      number: newNum,
      sectionId: secId,
      content: 'Nhập nội dung câu hỏi mới tại đây (hỗ trợ công thức $y = ax + b$)...',
      options: [
        { id: 'A', text: 'Phương án A' },
        { id: 'B', text: 'Phương án B' },
        { id: 'C', text: 'Phương án C' },
        { id: 'D', text: 'Phương án D' }
      ],
      correctOptionId: 'A',
      points: 0,
      explanation: 'Lời giải chi tiết câu hỏi...'
    };
    const updated = normalizeAndDistributeQuestions([...questions, newQ], sections, totalPoints);
    setQuestions(updated);
  };

  const handleDeleteQuestion = (id: string) => {
    const filtered = questions.filter((q) => q.id !== id);
    setQuestions(normalizeAndDistributeQuestions(filtered, sections, totalPoints));
  };

  const handleUpdateQuestion = (id: string, partial: Partial<Question>) => {
    setQuestions((prev) => {
      const updated = prev.map((q) => (q.id === id ? { ...q, ...partial } : q));
      if (partial.sectionId) {
        return normalizeAndDistributeQuestions(updated, sections, totalPoints);
      }
      return updated;
    });
  };

  const handleUpdateOption = (qId: string, optId: string, newText: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          options: q.options.map((opt) => (opt.id === optId ? { ...opt, text: newText } : opt))
        };
      })
    );
  };

  const handleSaveExam = () => {
    // If user pasted TeX in current section but forgot to click "Trích xuất câu hỏi từ TeX", parse automatically!
    let finalQuestions = questions;
    const currentSectionHasQuestions = finalQuestions.some((q) => q.sectionId === targetSectionId);
    if (!currentSectionHasQuestions && currentTexSource.trim()) {
      const parsed = parseTexExam(currentTexSource, totalPoints).map((q) => ({
        ...q,
        sectionId: targetSectionId
      }));
      if (parsed.length > 0) {
        finalQuestions = normalizeAndDistributeQuestions(
          [...finalQuestions, ...parsed],
          sections,
          totalPoints
        );
        setQuestions(finalQuestions);
      }
    }

    if (!title.trim()) {
      setTexErrorMsg('Vui lòng nhập tên đề thi ở mục Cài đặt!');
      return;
    }
    if (finalQuestions.length === 0) {
      setTexErrorMsg(
        'Đề thi chưa có câu hỏi nào! Vui lòng tải tệp .tex, dán mã TeX rồi bấm "Trích xuất câu hỏi", hoặc thêm câu hỏi thủ công.'
      );
      return;
    }

    const computedTotalPoints =
      sections.reduce((acc, s) => acc + (s.isTieBreaker ? 0 : Number(s.totalPoints) || 0), 0) ||
      Number(totalPoints) ||
      10;

    const examData: Exam = {
      id: initialExam?.id || `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      code: code.trim().toUpperCase() || 'ELABS-2026',
      title: title.trim(),
      sections,
      durationMinutes: Number(durationMinutes) || 45,
      totalPoints: computedTotalPoints,
      pointDistribution: 'equal',
      password: password.trim(),
      settings: {
        sequentialParts,
        shuffleQuestions,
        shuffleOptions,
        requireFullscreen,
        strictFullscreenLock,
        trackTabSwitch,
        maxTabSwitches: Number(maxTabSwitches) || 3,
        autoSubmitOnMaxViolations,
        showResultImmediately,
        showExplanations,
        allowReviewAnswers: true,
        candidateFields,
        allowDemoFill,
        entryRuleNote: entryRuleNote.trim(),
        maxAttempts: Number(maxAttempts) >= 0 ? Number(maxAttempts) : 1
      },
      questions: finalQuestions,
      status: initialExam?.status || 'published',
      createdAt: initialExam?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    onSave(examData);
  };

  const activeTargetSection = sections.find((s) => s.id === targetSectionId) || sections[0];
  const displayedQuestions =
    questionFilterSectionId === 'all'
      ? questions
      : questions.filter((q) => (q.sectionId || sections[0]?.id) === questionFilterSectionId);

  const renderCandidateFormConfigurator = () => (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <span>Tùy chỉnh biểu mẫu thí sinh &amp; Menu thả xuống chọn Đội thi</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Hỗ trợ <strong>Menu thả xuống (Dropdown)</strong> để thí sinh click chọn Đội thi chính xác (tránh gõ sai tên đội) và tự động <strong>Gộp chung điểm các thành viên cùng Đội</strong> lên Bảng xếp hạng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setCandidateFields(
                TEAM_CANDIDATE_FIELDS.map((f) => ({
                  ...f,
                  options: f.options ? [...f.options] : undefined
                }))
              )
            }
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            📋 Mẫu Thi theo Đội (Menu thả xuống chọn Đội)
          </button>
          <button
            type="button"
            onClick={() =>
              setCandidateFields(
                DEFAULT_CANDIDATE_FIELDS.map((f) => ({
                  ...f,
                  options: f.options ? [...f.options] : undefined
                }))
              )
            }
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Mẫu Cá nhân (Nhập tự do)
          </button>
          <button
            type="button"
            onClick={() => handleAddCandidateField('select')}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Thêm Menu thả xuống</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddCandidateField('text')}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Thêm ô nhập chữ</span>
          </button>
        </div>
      </div>

      {/* Field List Editor */}
      <div className="space-y-4">
        {candidateFields.map((field, index) => {
          const isSelect = field.type === 'select';
          const optionsList = field.options || [];
          const quickOptVal = newOptionInputs[field.id] || '';

          const handleAddSingleOption = () => {
            const trimmed = quickOptVal.trim();
            if (!trimmed) return;
            const nextOpts = Array.from(new Set([...optionsList, trimmed]));
            handleUpdateCandidateField(field.id, { options: nextOpts });
            setNewOptionInputs((prev) => ({ ...prev, [field.id]: '' }));
          };

          const handleRemoveOption = (optToRemove: string) => {
            handleUpdateCandidateField(field.id, {
              options: optionsList.filter((o) => o !== optToRemove)
            });
          };

          return (
            <div
              key={field.id}
              className={`p-4 rounded-2xl border transition-all ${
                field.enabled
                  ? isSelect
                    ? 'border-indigo-200 bg-indigo-50/30'
                    : 'border-slate-200 bg-slate-50/70'
                  : 'border-slate-200/60 bg-slate-100/50 opacity-60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveCandidateField(index, 'up')}
                      className="px-1.5 py-0.5 text-[11px] font-bold bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      title="Đưa lên trên"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === candidateFields.length - 1}
                      onClick={() => handleMoveCandidateField(index, 'down')}
                      className="px-1.5 py-0.5 text-[11px] font-bold bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      title="Đưa xuống dưới"
                    >
                      ↓
                    </button>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.enabled}
                      onChange={(e) =>
                        handleUpdateCandidateField(field.id, { enabled: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      {field.enabled ? 'Đang hiển thị' : 'Đã ẩn'}
                    </span>
                  </label>

                  {/* Input Type Selector: Text vs Dropdown Select */}
                  <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => handleUpdateCandidateField(field.id, { type: 'text' })}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        !isSelect
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Ô nhập chữ (Text)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateCandidateField(field.id, { type: 'select' })}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        isSelect
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      ▼ Menu thả xuống (Click chọn)
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 font-semibold text-indigo-800 bg-indigo-100/80 px-2.5 py-1 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(field.isTeamGroupField)}
                      disabled={!field.enabled}
                      onChange={(e) =>
                        handleUpdateCandidateField(field.id, { isTeamGroupField: e.target.checked })
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Dùng để Gộp chung điểm Đội thi</span>
                  </label>

                  <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.required}
                      disabled={!field.enabled}
                      onChange={(e) =>
                        handleUpdateCandidateField(field.id, { required: e.target.checked })
                      }
                      className="rounded text-red-600 focus:ring-red-500"
                    />
                    <span>Bắt buộc (*)</span>
                  </label>

                  <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(field.isHalfWidth)}
                      disabled={!field.enabled}
                      onChange={(e) =>
                        handleUpdateCandidateField(field.id, { isHalfWidth: e.target.checked })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Xếp 1/2 dòng</span>
                  </label>

                  {candidateFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCandidateField(field.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa trường thông tin này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tên mục hiển thị cho thí sinh (Label):
                  </label>
                  <input
                    type="text"
                    value={field.label}
                    disabled={!field.enabled}
                    onChange={(e) =>
                      handleUpdateCandidateField(field.id, { label: e.target.value })
                    }
                    placeholder="Ví dụ: Chọn Đội thi, Họ và tên thí sinh, MSSV..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {isSelect
                      ? 'Dòng hướng dẫn mặc định trên Menu thả xuống:'
                      : 'Chữ gợi ý bên trong ô nhập (Placeholder):'}
                  </label>
                  <input
                    type="text"
                    value={field.placeholder}
                    disabled={!field.enabled}
                    onChange={(e) =>
                      handleUpdateCandidateField(field.id, { placeholder: e.target.value })
                    }
                    placeholder={
                      isSelect
                        ? '-- Bấm vào đây để chọn Đội thi của bạn --'
                        : 'Ví dụ: Nhập họ tên đầy đủ...'
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Dropdown Options Manager when type === 'select' */}
              {isSelect && field.enabled && (
                <div className="mt-3 pt-3 border-t border-indigo-200/70 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-indigo-950">
                        Danh sách các lựa chọn trong Menu thả xuống ({optionsList.length} mục):
                      </span>
                      <p className="text-[11px] text-indigo-700">
                        Thí sinh sẽ chỉ được click chọn 1 trong các mục dưới đây (không lo gõ sai tên đội).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={quickOptVal}
                        onChange={(e) =>
                          setNewOptionInputs((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSingleOption();
                          }
                        }}
                        placeholder="Nhập tên Đội thi mới..."
                        className="px-3 py-1.5 bg-white border border-indigo-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddSingleOption}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shrink-0"
                      >
                        + Thêm đội
                      </button>
                    </div>
                  </div>

                  {/* Option chips */}
                  {optionsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 bg-white p-2.5 rounded-xl border border-indigo-100">
                      {optionsList.map((opt, oIdx) => (
                        <span
                          key={`${opt}_${oIdx}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-semibold"
                        >
                          <span className="text-[10px] font-bold text-indigo-500">
                            #{oIdx + 1}
                          </span>
                          <span>{opt}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(opt)}
                            className="text-indigo-400 hover:text-red-600 font-bold ml-0.5 cursor-pointer"
                            title="Xóa lựa chọn này"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Multi-line bulk edit textarea */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nhập / Dán nhanh danh sách Đội thi từ Excel hoặc Word (Mỗi dòng là 1 Đội thi):
                    </label>
                    <textarea
                      rows={4}
                      value={optionsList.join('\n')}
                      onChange={(e) => {
                        const lines = e.target.value
                          .split('\n')
                          .map((line) => line.replace(/\r/g, ''));
                        handleUpdateCandidateField(field.id, { options: lines });
                      }}
                      onBlur={() => {
                        const cleaned = optionsList
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0);
                        handleUpdateCandidateField(field.id, { options: cleaned });
                      }}
                      placeholder={'Đội 01 - ELABS Alpha\nĐội 02 - ELABS Beta\nĐội 03 - ELABS Gamma'}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Extra Candidate Modal Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nội dung lưu ý Quy chế thi (hiển thị dưới biểu mẫu thí sinh)
          </label>
          <textarea
            value={entryRuleNote}
            onChange={(e) => setEntryRuleNote(e.target.value)}
            rows={2}
            placeholder="Nội dung quy chế phòng thi..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex flex-col justify-center">
          <label className="flex items-start gap-2.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={allowDemoFill}
              onChange={(e) => setAllowDemoFill(e.target.checked)}
              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="font-bold text-slate-800">
                Hiển thị nút &ldquo;Điền nhanh mẫu sinh viên&rdquo; trên form thí sinh
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Khi tắt (khuyên dùng khi thi thật), thí sinh bắt buộc tự chọn Đội thi và nhập thông tin của mình.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Live Preview of Candidate Entry Form */}
      <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/30 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
            Xem trước biểu mẫu thí sinh sẽ nhìn thấy khi vào thi (Bạn có thể bấm thử Menu thả xuống):
          </span>
          {allowDemoFill && (
            <span className="text-[11px] font-semibold text-blue-600">
              Điền nhanh mẫu sinh viên
            </span>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3">
          {candidateFields
            .filter((f) => f.enabled)
            .map((f) => {
              const validOpts = (f.options || []).map((o) => o.trim()).filter(Boolean);
              return (
                <div key={f.id} className={f.isHalfWidth ? 'md:col-span-1' : 'md:col-span-2'}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                    {f.isTeamGroupField && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                        Gộp BXH theo mục này
                      </span>
                    )}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      defaultValue=""
                      className="w-full px-3 py-2 bg-slate-50 border border-indigo-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">
                        {f.placeholder || `-- Chọn ${f.label} --`}
                      </option>
                      {validOpts.map((opt, idx) => (
                        <option key={`${opt}_${idx}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      readOnly
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500"
                    />
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-200">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700">
            Khu vực Quản trị / Ban Tổ Chức
          </span>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 mt-1">
            {initialExam ? 'Chỉnh sửa đề thi' : 'Tạo mới đề thi trắc nghiệm TeX'}
          </h1>
          <p className="text-xs text-slate-500">
            Hỗ trợ chia đề thi thành nhiều phần (Phần 1, Phần 2...), tùy chỉnh thông tin thí sinh và cấu hình điểm tự động
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={editorFileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportCurrentExamJson}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => editorFileInputRef.current?.click()}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Nạp đề thi từ file .json trong máy tính"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Nạp file (.json)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCurrentExamJson}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Tải bản sao lưu đề thi này về máy (.json) để lưu trữ an toàn"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải về máy (.json)</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSaveExam}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Lưu &amp; Xuất bản đề thi</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-sm font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('tex')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'tex'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>1. Nhập đề TeX / LaTeX</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'questions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>2. Câu hỏi &amp; Chia điểm ({questions.length} câu)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>3. Cài đặt phòng thi &amp; Các phần thi ({sections.length} phần)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('candidate-form')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'candidate-form'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>4. Thông tin thí sinh dự thi ({candidateFields.filter((f) => f.enabled).length} mục)</span>
        </button>
      </div>

      {/* TAB 1: TEX / LATEX IMPORT */}
      {activeTab === 'tex' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            {/* Section Selector Bar for Multi-part Import */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Chọn phần thi để nạp đề TeX (Hết Phần 1 sang Phần 2):
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm phần thi mới</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {sections.map((sec, idx) => {
                  const countInSec = questions.filter(
                    (q) => (q.sectionId || sections[0]?.id) === sec.id
                  ).length;
                  const isSelected = activeTargetSection?.id === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        setTargetSectionId(sec.id);
                        setTexParseSuccessMsg('');
                        setTexErrorMsg('');
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                      }`}
                    >
                      <span>
                        {idx + 1}. {sec.title}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {countInSec} câu • {sec.isTieBreaker ? 'Câu phụ (0đ)' : `${sec.totalPoints ?? 10}đ`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick section points & tie-breaker config right inside Tab 1 */}
              {activeTargetSection && (
                <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-bold text-slate-700">
                      Cấu hình điểm cho <span className="text-blue-700">{activeTargetSection.title}</span>:
                    </span>
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(activeTargetSection.isTieBreaker)}
                        onChange={(e) =>
                          handleUpdateSection(activeTargetSection.id, {
                            isTieBreaker: e.target.checked
                          })
                        }
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>Phần câu hỏi phụ (0 điểm - chỉ xét khi bằng điểm chính)</span>
                    </label>

                    {!activeTargetSection.isTieBreaker && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-600 font-semibold">Tổng điểm {activeTargetSection.title}:</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={activeTargetSection.totalPoints ?? 10}
                          onChange={(e) =>
                            handleUpdateSection(activeTargetSection.id, {
                              totalPoints: Math.max(0, Number(e.target.value) || 0)
                            })
                          }
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-blue-700"
                        />
                        <span className="text-slate-600">điểm</span>
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-500">
                    Khi trích xuất TeX, câu hỏi sẽ tự động chia điểm theo cấu hình của <strong>{activeTargetSection.title}</strong>.
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>
                    Nhập mã TeX / LaTeX cho {activeTargetSection?.title}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hỗ trợ định dạng chuẩn Ex_test, VietTeX (`\begin&#123;ex&#125; ... \choice&#123;A&#125;&#123;B&#125;&#123;C&#125;&#123;D&#125; \end&#123;ex&#125;`), `\immini`, `\begin&#123;tikzpicture&#125;` và `\loigiai`.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs">
                  <Upload className="w-4 h-4" />
                  <span>Tải tệp .tex cho {activeTargetSection?.title}</span>
                  <input
                    type="file"
                    accept=".tex,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleLoadSampleTex}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Nạp mẫu vào {activeTargetSection?.title}</span>
                </button>

                {currentTexSource && (
                  <button
                    type="button"
                    onClick={handleClearCurrentSectionQuestions}
                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-amber-200"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa {activeTargetSection?.title}</span>
                  </button>
                )}

                {questions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllTexAndQuestions}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa tất cả các phần</span>
                  </button>
                )}
              </div>
            </div>

            {texErrorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{texErrorMsg}</span>
              </div>
            )}

            {texParseSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{texParseSuccessMsg}</span>
              </div>
            )}

            {/* Raw TeX Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 font-mono uppercase">
                  MÃ NGUỒN TEX / LATEX ({activeTargetSection?.title}):
                </label>
                <span className="text-[11px] text-slate-400">
                  Dán mã TeX của {activeTargetSection?.title} bên dưới rồi bấm Trích xuất
                </span>
              </div>
              <textarea
                value={currentTexSource}
                onChange={(e) => setCurrentTexSource(e.target.value)}
                rows={12}
                className="w-full p-4 font-mono text-xs bg-slate-900 text-emerald-400 rounded-xl border border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                placeholder={`% Dán nội dung câu hỏi TeX của ${activeTargetSection?.title} tại đây...\n\\begin{ex} ... \\choice{A}{B}{C}{D} \\end{ex}`}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <span className="text-xs text-slate-500">
                Tổng toàn đề thi hiện có: <strong>{questions.length} câu hỏi</strong> ({sections.map((s) => `${s.title}: ${questions.filter((q) => (q.sectionId || sections[0]?.id) === s.id).length} câu`).join(' • ')})
              </span>

              <button
                type="button"
                onClick={handleParseCurrentTex}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Trích xuất TeX vào {activeTargetSection?.title}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUESTIONS & POINT DISTRIBUTION */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          {/* Point Distribution by Section & Section Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <span>Tổng số câu hỏi:</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">
                    {questions.length} câu
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Tổng điểm chính thức:</span>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-extrabold">
                    {questions.reduce((acc, q) => acc + (q.points > 0 ? q.points : 0), 0).toFixed(2)} / {totalPoints} điểm
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDistributePoints}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Tự động chia đều điểm trong từng phần theo cấu hình bên dưới"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Chia đều điểm theo từng phần</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddQuestion()}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm câu hỏi mới</span>
                </button>
              </div>
            </div>

            {/* PER-SECTION POINT ALLOCATION PANEL */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  <span>Cấu hình chia điểm cho từng phần (Phần câu hỏi chính &amp; Phần câu hỏi phụ):</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Phần câu hỏi phụ (0đ) không cộng vào điểm chính, chỉ dùng để phân định thứ hạng khi các đội bằng điểm nhau.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sections.map((sec, idx) => {
                  const secQs = questions.filter((q) => (q.sectionId || sections[0]?.id) === sec.id);
                  const countInSec = secQs.length;
                  const isTie = Boolean(sec.isTieBreaker);
                  const secPoints = isTie ? 0 : (sec.totalPoints ?? 10);
                  const avgPerQuestion =
                    !isTie && countInSec > 0 ? +(secPoints / countInSec).toFixed(2) : 0;

                  return (
                    <div
                      key={sec.id}
                      className={`p-3.5 rounded-xl border space-y-2.5 transition-colors ${
                        isTie
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-lg text-white text-xs font-bold flex items-center justify-center ${
                              isTie ? 'bg-amber-600' : 'bg-blue-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900">
                            {sec.title}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {countInSec} câu hỏi
                          </span>
                        </div>

                        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isTie}
                            onChange={(e) =>
                              handleUpdateSection(sec.id, { isTieBreaker: e.target.checked })
                            }
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Câu hỏi phụ (Xét khi bằng điểm)</span>
                        </label>
                      </div>

                      {isTie ? (
                        <div className="text-[11px] text-amber-900 bg-amber-100/70 px-3 py-1.5 rounded-lg font-medium flex items-center justify-between">
                          <span>Không tính vào tổng điểm chính (0đ / câu)</span>
                          <span className="font-bold">Dùng xét phụ khi bằng điểm</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-semibold">Tổng điểm {sec.title}:</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={secPoints}
                              onChange={(e) =>
                                handleUpdateSection(sec.id, {
                                  totalPoints: Math.max(0, Number(e.target.value) || 0)
                                })
                              }
                              className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-center font-extrabold text-blue-700"
                            />
                            <span className="text-slate-600 font-semibold">điểm</span>
                          </div>
                          <span className="text-[11px] text-emerald-700 font-bold">
                            {countInSec > 0
                              ? `≈ ${avgPerQuestion}đ / câu (${countInSec} câu)`
                              : 'Chưa có câu hỏi'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Filter by Section (Phần 1, Phần 2...) */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Xem theo phần:</span>
              </span>
              <button
                type="button"
                onClick={() => setQuestionFilterSectionId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  questionFilterSectionId === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({questions.length} câu)
              </button>
              {sections.map((sec) => {
                const cnt = questions.filter((q) => (q.sectionId || sections[0]?.id) === sec.id).length;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setQuestionFilterSectionId(sec.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      questionFilterSectionId === sec.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sec.title} ({cnt} câu • {sec.isTieBreaker ? 'Câu phụ 0đ' : `${sec.totalPoints ?? 10}đ`})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-4">
            {displayedQuestions.map((q) => {
              const secObj =
                sections.find((s) => s.id === (q.sectionId || sections[0]?.id)) || sections[0];
              return (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
                >
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                        {q.number}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        Câu hỏi số {q.number}
                      </span>

                      {/* Section Selector for this question */}
                      <select
                        value={secObj?.id || ''}
                        onChange={(e) => handleUpdateQuestion(q.id, { sectionId: e.target.value })}
                        className="ml-2 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold outline-none cursor-pointer"
                        title="Chuyển câu hỏi này sang phần thi khác"
                      >
                        {sections.map((s) => (
                          <option key={s.id} value={s.id}>
                            Thuộc: {s.title} {s.isTieBreaker ? '(Câu hỏi phụ - 0đ)' : `(${s.totalPoints ?? 10}đ)`}
                          </option>
                        ))}
                      </select>

                      {secObj?.isTieBreaker && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Câu hỏi phụ (Chỉ xét khi bằng điểm)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                        <span>Điểm câu này:</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          value={q.points}
                          onChange={(e) => handleUpdateQuestion(q.id, { points: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-center"
                        />
                        <span>đ</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Xóa câu hỏi này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question Prompt Editor */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nội dung câu hỏi (hỗ trợ văn bản và công thức LaTeX trong dấu $...$):
                    </label>
                    <textarea
                      value={q.content}
                      onChange={(e) => handleUpdateQuestion(q.id, { content: e.target.value })}
                      rows={2}
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-mono"
                    />
                    {/* Live Render Preview */}
                    <div className="mt-2 p-2.5 bg-blue-50/50 rounded-lg border border-blue-100 text-xs">
                      <span className="text-[10px] font-bold uppercase text-blue-600 block mb-1">
                        Xem trước công thức hiển thị:
                      </span>
                      <MathView content={q.content} />
                    </div>
                  </div>

                  {/* Image configuration */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                        <span>Hình ảnh minh họa / sơ đồ mạch điện (không bắt buộc):</span>
                        {q.tikzCode && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold">
                            Đã tách &amp; vẽ tự động từ TikZ (\immini)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Tải ảnh lên</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleQuestionImageUpload(q.id, e)}
                            className="hidden"
                          />
                        </label>
                        {q.imageUrl && (
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(q.id, { imageUrl: '' })}
                            className="px-2 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            Xóa ảnh
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={q.imageUrl || ''}
                        onChange={(e) => handleUpdateQuestion(q.id, { imageUrl: e.target.value })}
                        onPaste={(e) => handleQuestionImagePaste(q.id, e)}
                        placeholder="Dán link ảnh (https://...) hoặc bấm Ctrl+V để dán ảnh chụp màn hình"
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        value={q.imageCaption || ''}
                        onChange={(e) => handleUpdateQuestion(q.id, { imageCaption: e.target.value })}
                        placeholder="Chú thích ảnh (Ví dụ: Hình 1: Sơ đồ mạch điện)"
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    {q.imageUrl && (
                      <div className="pt-2">
                        <img
                          src={q.imageUrl}
                          alt="Preview"
                          className="max-h-44 rounded-lg border border-slate-300 bg-white p-1 object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Choices list with radio for correct answer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Các phương án trắc nghiệm (Chọn vòng tròn để đặt đáp án đúng):</span>
                      <span className="text-emerald-700 font-bold">
                        Đáp án đúng hiện tại: {q.correctOptionId}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {q.options.map((opt) => {
                        const isCorrect = q.correctOptionId === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-xl border space-y-1.5 ${
                              isCorrect ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuestion(q.id, { correctOptionId: opt.id })}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all cursor-pointer ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                                }`}
                                title={`Đặt ${opt.id} làm đáp án đúng`}
                              >
                                {opt.id}
                              </button>
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => handleUpdateOption(q.id, opt.id, e.target.value)}
                                placeholder={`Nội dung đáp án ${opt.id}`}
                                className="flex-1 px-2.5 py-1 bg-white/80 border border-slate-200 rounded-lg text-xs outline-none font-mono focus:border-blue-400"
                              />
                            </div>
                            {(opt.text.includes('$') || opt.text.includes('\\')) && (
                              <div className="pl-8 text-xs text-slate-700">
                                <MathView content={opt.text} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lời giải chi tiết (\loigiai):
                    </label>
                    <textarea
                      value={q.explanation || ''}
                      onChange={(e) => handleUpdateQuestion(q.id, { explanation: e.target.value })}
                      rows={2}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                      placeholder="Hướng dẫn giải chi tiết cho thí sinh xem sau khi thi..."
                    />
                    {q.explanation && (
                      <div className="mt-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                          Xem trước lời giải:
                        </span>
                        <MathView content={q.explanation} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {displayedQuestions.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
                <p className="text-sm font-bold text-slate-700">
                  Chưa có câu hỏi nào trong phần này.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('tex')}
                    className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Nhập từ mã TeX
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuestion()}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    + Thêm câu hỏi thủ công
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS, EXAM PARTS & ANTI-CHEAT */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
            <span>Cấu hình phòng thi &amp; Chống gian lận</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên đề thi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã phòng thi (Thí sinh dùng để vào thi)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thời gian làm bài (Phút)
              </label>
              <input
                type="number"
                min="1"
                max="180"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 45)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mật khẩu phòng thi (để trống nếu cho phép vào tự do)
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Để trống nếu không đặt mật khẩu"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngưỡng cảnh báo chuyển tab vi phạm
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxTabSwitches}
                onChange={(e) => setMaxTabSwitches(Number(e.target.value) || 3)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* EXAM SECTIONS (PHẦN 1, PHẦN 2, ...) CONFIGURATION */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Cấu hình các phần của đề thi &amp; Điểm từng phần (Hết Phần 1 sang Phần 2)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Thiết lập điểm số cho từng phần hoặc đánh dấu phần câu hỏi phụ (0 điểm - chỉ dùng xét phụ khi các đội bằng điểm chính).
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSection}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm phần thi mới</span>
              </button>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-blue-200 bg-blue-50/50 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={sequentialParts}
                onChange={(e) => setSequentialParts(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-bold text-blue-950">
                  Hiển thị bài thi theo từng phần (Làm hết Phần 1 chuyển sang Phần 2)
                </div>
                <div className="text-[11px] text-blue-700">
                  Khi bật, giao diện phòng thi sẽ chia theo từng phần rõ ràng và có nút &ldquo;Sang Phần tiếp theo&rdquo; khi thí sinh làm đến cuối mỗi phần.
                </div>
              </div>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sections.map((sec, idx) => {
                const qCount = questions.filter(
                  (q) => (q.sectionId || sections[0]?.id) === sec.id
                ).length;
                const isTie = Boolean(sec.isTieBreaker);
                return (
                  <div
                    key={sec.id}
                    className={`p-4 rounded-2xl border space-y-2.5 ${
                      isTie ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-lg text-white text-xs font-bold flex items-center justify-center ${
                            isTie ? 'bg-amber-600' : 'bg-blue-600'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          Phần thi thứ {idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold">
                          {qCount} câu hỏi
                        </span>
                      </div>

                      {sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(sec.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa phần thi này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          Tên phần thi:
                        </label>
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) => handleUpdateSection(sec.id, { title: e.target.value })}
                          placeholder={`Ví dụ: Phần ${idx + 1}`}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          Mô tả / Ghi chú phần thi (không bắt buộc):
                        </label>
                        <input
                          type="text"
                          value={sec.description || ''}
                          onChange={(e) => handleUpdateSection(sec.id, { description: e.target.value })}
                          placeholder="Ví dụ: Câu hỏi chính hoặc Câu hỏi phụ..."
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      {/* Section Points & Tie-breaker configuration */}
                      <div className="pt-1 border-t border-slate-200/70 space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-amber-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isTie}
                            onChange={(e) =>
                              handleUpdateSection(sec.id, { isTieBreaker: e.target.checked })
                            }
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>Phần câu hỏi phụ (0 điểm - chỉ xét khi bằng điểm chính)</span>
                        </label>

                        {!isTie && (
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-600 font-semibold">Tổng điểm của phần này:</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={sec.totalPoints ?? 10}
                                onChange={(e) =>
                                  handleUpdateSection(sec.id, {
                                    totalPoints: Math.max(0, Number(e.target.value) || 0)
                                  })
                                }
                                className="w-20 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-center font-extrabold text-blue-700"
                              />
                              <span className="text-slate-600 font-semibold">điểm</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="p-3.5 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 to-blue-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span>Giới hạn số lượt thi / mỗi thí sinh (MSSV/SBD)</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Kiểm soát mỗi thí sinh được nộp bài tối đa bao nhiêu lần để đảm bảo tính công bằng
                </div>
              </div>
              <select
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 shadow-xs cursor-pointer"
              >
                <option value={1}>1 lượt (Thi chính thức - Chỉ thi 1 lần duy nhất)</option>
                <option value={2}>2 lượt (Cho phép làm lại 1 lần nếu gặp sự cố)</option>
                <option value={3}>3 lượt</option>
                <option value={5}>5 lượt</option>
                <option value={0}>Không giới hạn (Luyện tập tự do)</option>
              </select>
            </div>

            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Tùy chọn chống gian lận &amp; Hiển thị
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackTabSwitch}
                  onChange={(e) => setTrackTabSwitch(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-slate-800">Giám sát rời màn hình / chuyển tab</div>
                  <div className="text-[11px] text-slate-500">Cảnh báo và ghi nhận số lần thí sinh chuyển tab hoặc mở app khác</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={strictFullscreenLock}
                  onChange={(e) => setStrictFullscreenLock(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-blue-950">Khóa Toàn màn hình nghiêm ngặt (ELABS Engine)</div>
                  <div className="text-[11px] text-blue-700">Khóa cố định Fullscreen, đếm ngược 15s phục hồi và khóa thao tác khi vi phạm</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-red-200 bg-red-50/40 hover:bg-red-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSubmitOnMaxViolations}
                  onChange={(e) => setAutoSubmitOnMaxViolations(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <div>
                  <div className="font-semibold text-red-950">Tự động đình chỉ thi khi quá số lần vi phạm</div>
                  <div className="text-[11px] text-red-700">Tự động nộp bài và đình chỉ (0 điểm) nếu thí sinh cố tình thoát toàn màn hình</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireFullscreen}
                  onChange={(e) => setRequireFullscreen(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-slate-800">Yêu cầu toàn màn hình</div>
                  <div className="text-[11px] text-slate-500">Bắt buộc bật chế độ Fullscreen trước khi nhìn thấy câu hỏi</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-slate-800">Đảo thứ tự câu hỏi</div>
                  <div className="text-[11px] text-slate-500">Xáo trộn vị trí câu hỏi trong mỗi phần để chống nhìn bài</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showResultImmediately}
                  onChange={(e) => setShowResultImmediately(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-slate-800">Xem điểm số ngay khi nộp bài</div>
                  <div className="text-[11px] text-slate-500">Thí sinh biết điểm thi ngay lập tức sau khi bấm Nộp bài</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showExplanations}
                  onChange={(e) => setShowExplanations(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-slate-800">Hiển thị lời giải chi tiết sau khi nộp</div>
                  <div className="text-[11px] text-slate-500">Cho phép thí sinh xem đối chiếu đáp án và cách giải từng câu</div>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            {renderCandidateFormConfigurator()}
          </div>
        </div>
      )}

      {/* TAB 4: CANDIDATE FORM CUSTOMIZATION */}
      {activeTab === 'candidate-form' && renderCandidateFormConfigurator()}
    </div>
  );
};
