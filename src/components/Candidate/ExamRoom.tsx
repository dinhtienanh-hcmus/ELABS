import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Exam, CandidateInfo, Question } from '../../types/exam';
import { MathView } from '../MathView';
import { ImageLightbox } from '../ImageLightbox';
import { saveActiveTakerPing, removeActiveTaker } from '../../utils/storage';
import {
  Clock,
  Bookmark,
  Send,
  AlertTriangle,
  ZoomIn,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ListOrdered,
  Layers,
  Lock,
  Unlock,
  Wifi,
  AlertOctagon,
  EyeOff
} from 'lucide-react';

interface ExamRoomProps {
  exam: Exam;
  candidateInfo: CandidateInfo;
  onSubmitExam: (
    answers: Record<string, string>,
    timeSpentSeconds: number,
    tabSwitchLogs: { timestamp: number; message: string }[],
    isDisqualified?: boolean,
    disqualificationReason?: string
  ) => void;
  onExit: () => void;
}

export const ExamRoom: React.FC<ExamRoomProps> = ({
  exam,
  candidateInfo,
  onSubmitExam,
  onExit
}) => {
  // Session storage key for auto-recovery if user accidentally refreshes
  const sessionKey = useMemo(
    () => `elabs_exam_session_${exam.id}_${candidateInfo.candidateCode}`,
    [exam.id, candidateInfo.candidateCode]
  );

  // Initial answer loading from local storage
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(sessionKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.answers) return parsed.answers;
      }
    } catch {
      // ignore
    }
    return {};
  });

  const [markedForReview, setMarkedForReview] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(sessionKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.marked) return new Set(parsed.marked);
      }
    } catch {
      // ignore
    }
    return new Set<string>();
  });

  // Time management (Drift-compensated countdown)
  const totalSeconds = exam.durationMinutes * 60;
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(sessionKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.remainingSeconds === 'number' && parsed.remainingSeconds > 0) {
          return parsed.remainingSeconds;
        }
      }
    } catch {
      // ignore
    }
    return totalSeconds;
  });

  // STRICT FULLSCREEN LOCK & ANTI-CHEAT STATES
  // 1. Has candidate entered initial fullscreen?
  const [hasStartedFullscreen, setHasStartedFullscreen] = useState<boolean>(false);
  // 2. Is current browser in fullscreen right now?
  const [isFullscreenActive, setIsFullscreenActive] = useState<boolean>(false);
  // 3. Violation count & log
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);
  const tabSwitchLogsRef = useRef<{ timestamp: number; message: string }[]>([]);
  // 4. Return countdown timer (seconds) when violation occurs
  const [violationGraceSeconds, setViolationGraceSeconds] = useState<number>(15);
  const violationTimerRef = useRef<any>(null);

  const maxAllowedViolations = exam.settings.maxTabSwitches || 3;

  // View mode: 'all' (scrolling all questions) vs 'single' (one question at a time)
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
  const [currentSingleIndex, setCurrentSingleIndex] = useState<number>(0);

  // Active exam section (Phần 1, Phần 2...)
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);

  // Lightbox for diagram viewing
  const [lightboxImage, setLightboxImage] = useState<{ src: string; caption?: string } | null>(null);

  // Submit confirmation modal
  const [showConfirmSubmit, setShowConfirmSubmit] = useState<boolean>(false);

  // Session ID for live monitoring
  const sessionIdRef = useRef<string>(`elabs_session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

  // Effective sections that contain questions
  const effectiveSections = useMemo(() => {
    const rawSections =
      exam.sections && exam.sections.length > 0
        ? exam.sections
        : [{ id: 'part_1', title: 'Phần 1', description: '' }];
    const fallbackSecId = rawSections[0].id;
    const withCounts = rawSections.filter((sec) =>
      exam.questions.some((q) => (q.sectionId || fallbackSecId) === sec.id)
    );
    return withCounts.length > 0 ? withCounts : [rawSections[0]];
  }, [exam.sections, exam.questions]);

  // Questions prepared (ordered by section, and shuffled within section if settings require)
  const displayQuestions = useMemo(() => {
    const fallbackSecId =
      exam.sections && exam.sections.length > 0 ? exam.sections[0].id : 'part_1';
    const sectionOrder = new Map<string, number>();
    effectiveSections.forEach((sec, idx) => sectionOrder.set(sec.id, idx));

    const qs = exam.questions.map((q) => ({
      ...q,
      sectionId:
        q.sectionId && sectionOrder.has(q.sectionId) ? q.sectionId : effectiveSections[0].id || fallbackSecId
    }));

    return qs.sort((a, b) => {
      const secA = sectionOrder.get(a.sectionId!) ?? 0;
      const secB = sectionOrder.get(b.sectionId!) ?? 0;
      if (secA !== secB) return secA - secB;
      if (exam.settings.shuffleQuestions) {
        return a.id.localeCompare(b.id);
      }
      return a.number - b.number;
    });
  }, [exam.questions, exam.sections, exam.settings.shuffleQuestions, effectiveSections]);

  const currentSection = effectiveSections[activeSectionIndex] || effectiveSections[0];

  // Questions belonging to the currently active section (Phần 1, Phần 2...) with their global index
  const currentSectionQuestions = useMemo(() => {
    if (effectiveSections.length <= 1) {
      return displayQuestions.map((q, globalIdx) => ({ q, globalIdx }));
    }
    return displayQuestions
      .map((q, globalIdx) => ({ q, globalIdx }))
      .filter((item) => item.q.sectionId === currentSection.id);
  }, [displayQuestions, effectiveSections.length, currentSection]);

  // Persist state to localStorage on every change (0ms local-first backup)
  useEffect(() => {
    try {
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          answers,
          marked: Array.from(markedForReview),
          remainingSeconds
        })
      );
    } catch {
      // ignore
    }
  }, [answers, markedForReview, remainingSeconds, sessionKey]);

  // Heartbeat ping to storage for live monitoring & zero-lag synchronization
  useEffect(() => {
    const ping = () => {
      saveActiveTakerPing({
        sessionId: sessionIdRef.current,
        examId: exam.id,
        fullName: candidateInfo.fullName,
        candidateCode: candidateInfo.candidateCode,
        className: candidateInfo.className,
        startedAt: Date.now() - (totalSeconds - remainingSeconds) * 1000,
        lastPing: Date.now(),
        answeredCount: Object.keys(answers).length,
        totalQuestions: displayQuestions.length,
        tabSwitchCount,
        isCurrentlyFullscreen: isFullscreenActive
      });
    };

    ping();
    const interval = setInterval(ping, 3500);
    return () => {
      clearInterval(interval);
      removeActiveTaker(sessionIdRef.current);
    };
  }, [exam.id, candidateInfo, answers, displayQuestions.length, tabSwitchCount, remainingSeconds, totalSeconds, isFullscreenActive]);

  // Handle final submission (normal or disqualified)
  const handleFinalSubmit = useCallback(
    (isDisqualified: boolean = false, disqualificationReason?: string) => {
      const timeSpent = Math.max(1, totalSeconds - remainingSeconds);
      try {
        localStorage.removeItem(sessionKey);
      } catch {
        // ignore
      }
      removeActiveTaker(sessionIdRef.current);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      onSubmitExam(answers, timeSpent, tabSwitchLogsRef.current, isDisqualified, disqualificationReason);
    },
    [answers, remainingSeconds, totalSeconds, sessionKey, onSubmitExam]
  );

  // Timer countdown
  useEffect(() => {
    if (!hasStartedFullscreen) return; // Do not decrement until student activates exam

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStartedFullscreen, handleFinalSubmit]);

  // Request & enter Fullscreen lock
  const activateFullscreen = async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
      setHasStartedFullscreen(true);
      setIsFullscreenActive(true);
      setViolationGraceSeconds(15);
      if (violationTimerRef.current) {
        clearInterval(violationTimerRef.current);
        violationTimerRef.current = null;
      }
    } catch (e) {
      console.warn('Fullscreen request failed or was dismissed', e);
      // Fallback allowed for environments that block raw requestFullscreen
      setHasStartedFullscreen(true);
      setIsFullscreenActive(true);
    }
  };

  // FULLSCREEN & TAB ESCAPE DETECTION ENGINE
  useEffect(() => {
    const checkFullscreenState = () => {
      const isCurrentlyFull = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
      );

      setIsFullscreenActive(isCurrentlyFull);

      // If exam already started, but user exited fullscreen
      if (hasStartedFullscreen && !isCurrentlyFull) {
        handleViolation('Thoát chế độ toàn màn hình (Exit Full-Screen)');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && hasStartedFullscreen) {
        handleViolation('Chuyển tab hoặc ẩn cửa sổ bài thi (Tab switch / App blur)');
      }
    };

    const handleWindowBlur = () => {
      if (hasStartedFullscreen && !document.hidden) {
        handleViolation('Mất tiêu điểm màn hình thi (Chuyển sang ứng dụng khác)');
      }
    };

    const handleViolation = (reason: string) => {
      const timestamp = Date.now();
      const logMsg = `${reason} lúc ${new Date().toLocaleTimeString('vi-VN')}`;
      tabSwitchLogsRef.current.push({ timestamp, message: logMsg });

      setTabSwitchCount((prev) => {
        const next = prev + 1;
        // Check if exceeded max allowed violations
        if (exam.settings.autoSubmitOnMaxViolations && next > maxAllowedViolations) {
          // Immediately terminate exam due to cheating / repeated violations
          setTimeout(() => {
            handleFinalSubmit(
              true,
              `Đình chỉ bài thi: Thí sinh đã vi phạm thoát toàn màn hình ${next} lần, vượt quá giới hạn ${maxAllowedViolations} lần cho phép của Cuộc thi ELABS.`
            );
          }, 300);
        }
        return next;
      });

      // Start grace countdown timer (15 seconds to return to fullscreen)
      setViolationGraceSeconds(15);
      if (!violationTimerRef.current) {
        violationTimerRef.current = setInterval(() => {
          setViolationGraceSeconds((sec) => {
            if (sec <= 1) {
              clearInterval(violationTimerRef.current);
              violationTimerRef.current = null;
              // Auto-submit due to failure to return to fullscreen
              handleFinalSubmit(
                true,
                'Đình chỉ bài thi: Quá 15 giây không khôi phục chế độ toàn màn hình theo quy chế thi ELABS.'
              );
              return 0;
            }
            return sec - 1;
          });
        }, 1000);
      }
    };

    document.addEventListener('fullscreenchange', checkFullscreenState);
    document.addEventListener('webkitfullscreenchange', checkFullscreenState);
    document.addEventListener('mozfullscreenchange', checkFullscreenState);
    document.addEventListener('MSFullscreenChange', checkFullscreenState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreenState);
      document.removeEventListener('webkitfullscreenchange', checkFullscreenState);
      document.removeEventListener('mozfullscreenchange', checkFullscreenState);
      document.removeEventListener('MSFullscreenChange', checkFullscreenState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      if (violationTimerRef.current) clearInterval(violationTimerRef.current);
    };
  }, [hasStartedFullscreen, maxAllowedViolations, exam.settings.autoSubmitOnMaxViolations, handleFinalSubmit]);

  // Disable right click, copy/cut, and inspection shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F11 (browser fullscreen toggle without handler), F12 (DevTools)
      if (e.key === 'F11' || e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      // Block Ctrl+C, Ctrl+V, Ctrl+U, Ctrl+Shift+I, Ctrl+Shift+C
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 'p' || (e.shiftKey && e.key === 'I') || (e.shiftKey && e.key === 'C'))
      ) {
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Option selection handler - 0ms instant UI reaction
  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      next[questionId] = optionId;
      return next;
    });
  };

  // Toggle marked for review
  const toggleMarkForReview = (questionId: string) => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  // Switch to a specific section (Phần 1, Phần 2...)
  const handleSelectSection = (secIdx: number) => {
    const targetSec = effectiveSections[secIdx];
    if (!targetSec) return;
    setActiveSectionIndex(secIdx);
    const firstQIdx = displayQuestions.findIndex((q) => q.sectionId === targetSec.id);
    if (firstQIdx !== -1) {
      setCurrentSingleIndex(firstQIdx);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll to question (and automatically switch to its section if in another Phần)
  const scrollToQuestion = (questionId: string, idx: number) => {
    const targetQ = displayQuestions[idx];
    if (targetQ && effectiveSections.length > 1) {
      const secIdx = effectiveSections.findIndex((s) => s.id === targetQ.sectionId);
      if (secIdx !== -1 && secIdx !== activeSectionIndex) {
        setActiveSectionIndex(secIdx);
      }
    }
    if (viewMode === 'single') {
      setCurrentSingleIndex(idx);
    } else {
      setTimeout(() => {
        const elem = document.getElementById(`question_card_${questionId}`);
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 60);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = displayQuestions.length - answeredCount;
  const isTimeUrgent = remainingSeconds <= 300;

  // 1. INITIAL FULLSCREEN GATING SCREEN (Required before seeing questions)
  if (!hasStartedFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-blue-500/30 text-slate-800 space-y-6 animate-in zoom-in-95 duration-200">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <span>Khoa Điện tử - Viễn thông | Trường Đại học Khoa học tự nhiên, ĐHQG-HCM</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              CUỘC THI HỌC THUẬT ELABS LẦN THỨ XIX - NĂM 2026
            </h1>
            <p className="text-xs text-slate-500 font-semibold">
              Đề thi: <strong className="text-blue-700">{exam.title}</strong> (Mã: {exam.code})
            </p>
          </div>

          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4.5 space-y-3 text-xs text-amber-950">
            <div className="flex items-center gap-2 font-black text-sm text-amber-900">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>QUY CHẾ BẮT BUỘC: CỐ ĐỊNH TOÀN MÀN HÌNH (FULL-SCREEN LOCK)</span>
            </div>
            <ul className="space-y-1.5 list-disc pl-4 text-amber-900 leading-relaxed text-[11px] sm:text-xs">
              <li>
                Bài thi <strong>bắt buộc thực hiện ở chế độ Toàn màn hình</strong> trong suốt {exam.durationMinutes} phút.
              </li>
              <li>
                <strong>Nghiêm cấm thoát toàn màn hình</strong> (nhấn Esc, F11), chuyển tab trình duyệt hoặc mở các ứng dụng khác.
              </li>
              <li>
                Nếu thoát toàn màn hình, <strong>bài thi sẽ lập tức bị khóa</strong> và hệ thống đếm ngược 15 giây để thí sinh khôi phục.
              </li>
              <li>
                Vi phạm quá <strong>{maxAllowedViolations} lần</strong> sẽ bị <strong>hệ thống tự động đình chỉ và thu bài thi ngay lập tức</strong>.
              </li>
              <li>
                Mọi hành vi vi phạm đều được truyền trực tiếp đến máy chủ Giám thị BTC theo thời gian thực.
              </li>
            </ul>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Thí sinh:</span>
              <strong className="text-slate-900 font-bold">{candidateInfo.fullName}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">MSSV:</span>
              <strong className="text-slate-900 font-mono font-bold">{candidateInfo.candidateCode}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Lớp / Khóa:</span>
              <strong className="text-slate-900">{candidateInfo.className}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Thời gian thi:</span>
              <strong className="text-blue-700 font-bold">{exam.durationMinutes} phút ({exam.questions.length} câu)</strong>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={activateFullscreen}
              className="w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 active:scale-[0.98] text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Maximize2 className="w-5 h-5" />
              <span>BẬT TOÀN MÀN HÌNH &amp; BẮT ĐẦU LÀM BÀI</span>
            </button>
            <button
              type="button"
              onClick={onExit}
              className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 text-center transition-colors cursor-pointer"
            >
              Hủy bỏ và quay lại trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased selection:bg-blue-100 select-none">
      {/* 2. STRICT FULLSCREEN ESCAPE BLOCKER OVERLAY (Appears when user exits fullscreen or switches tabs) */}
      {!isFullscreenActive && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Cảnh báo cố định toàn màn hình"
          className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="max-w-lg w-full bg-slate-900 border-2 border-red-500 text-white rounded-3xl p-6 md:p-8 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-red-500/20 text-red-500 border border-red-500/30 flex items-center justify-center animate-bounce">
              <AlertOctagon className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-600 text-white inline-block">
                Phát Hiện Vi Phạm Cố Định Toàn Màn Hình
              </span>
              <h2 className="text-xl md:text-2xl font-black text-white pt-2">
                BÀI THI ELABS ĐÃ BỊ KHÓA!
              </h2>
              <p className="text-xs text-slate-300">
                Thí sinh vừa thoát khỏi chế độ toàn màn hình hoặc chuyển sang ứng dụng khác.
              </p>
            </div>

            {/* Violation Stats Box */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 grid grid-cols-2 gap-3 text-left text-xs">
              <div>
                <span className="text-slate-400 block">Số lần vi phạm:</span>
                <span className="text-xl font-black text-red-400">
                  {tabSwitchCount} / {maxAllowedViolations} lần
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Thời gian khôi phục:</span>
                <span className="text-xl font-black text-amber-400 font-mono">
                  {violationGraceSeconds} giây
                </span>
              </div>
            </div>

            <p className="text-[11px] text-red-300 leading-relaxed">
              ⚠️ Nếu không khôi phục Toàn màn hình trong <strong>{violationGraceSeconds} giây</strong> hoặc vi phạm quá <strong>{maxAllowedViolations} lần</strong>, bài thi sẽ bị <strong>ĐÌNH CHỈ VÀ NỘP BÀI CƯỠNG CHẾ</strong> với lý do gian lận!
            </p>

            <button
              type="button"
              onClick={activateFullscreen}
              className="w-full py-3.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              <span>KHÔI PHỤC TOÀN MÀN HÌNH NGAY</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Floating Exam Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Contest info & Candidate identity */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white tracking-wider shrink-0">
              ELABS XIX - 2026
            </span>
            <div className="truncate">
              <h1 className="text-sm md:text-base font-bold text-slate-900 truncate">
                {exam.title}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium truncate">
                <span className="text-slate-800 font-bold">{candidateInfo.fullName}</span>
                <span>•</span>
                <span>MSSV: <strong className="font-mono text-slate-800">{candidateInfo.candidateCode}</strong></span>
                <span>•</span>
                <span>Lớp: {candidateInfo.className}</span>
              </div>
            </div>
          </div>

          {/* Right Header Controls: Fullscreen status, Anti-cheat, Timer, Submit */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Strict Fullscreen Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Full-screen Lock [BẬT]</span>
            </div>

            {/* Anti-cheat tab alert badge */}
            {tabSwitchCount > 0 && (
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 border border-red-300 text-xs font-extrabold text-red-700 animate-pulse"
                title={`Cảnh báo: Bạn đã vi phạm ${tabSwitchCount} lần!`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                <span>Vi phạm: {tabSwitchCount}/{maxAllowedViolations}</span>
              </div>
            )}

            {/* View Mode Toggle: All vs Single */}
            <div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  viewMode === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Hiển thị cuộn tất cả câu hỏi"
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Tất cả</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  viewMode === 'single' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Hiển thị từng câu một"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Từng câu</span>
              </button>
            </div>

            {/* Countdown Timer Display */}
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-sm md:text-base font-extrabold shadow-xs transition-all ${
                isTimeUrgent
                  ? 'bg-red-600 text-white animate-pulse shadow-red-500/25'
                  : 'bg-slate-900 text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatTime(remainingSeconds)}</span>
            </div>

            {/* Nộp bài button */}
            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="px-4 py-1.5 md:py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs md:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Nộp bài</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Questions Container */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Multi-Part Exam Stepper Banner (Phần 1 -> Phần 2...) */}
          {effectiveSections.length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-extrabold uppercase">
                    {currentSection.title}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {currentSection.description || `Đang làm ${currentSection.title} (${currentSectionQuestions.length} câu hỏi)`}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  Phần {activeSectionIndex + 1} / {effectiveSections.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {effectiveSections.map((sec, sIdx) => {
                  const secQs = displayQuestions.filter((q) => q.sectionId === sec.id);
                  const secAnswered = secQs.filter((q) => Boolean(answers[q.id])).length;
                  const isActive = sIdx === activeSectionIndex;
                  const isDone = secQs.length > 0 && secAnswered === secQs.length;

                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleSelectSection(sIdx)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>
                        {sIdx + 1}. {sec.title}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : isDone
                            ? 'bg-emerald-200/70 text-emerald-900'
                            : 'bg-slate-200/80 text-slate-600'
                        }`}
                      >
                        {secAnswered}/{secQs.length} câu
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'all' ? (
            /* ALL QUESTIONS IN CURRENT SECTION VIEW */
            <div className="space-y-5">
              {currentSectionQuestions.map(({ q, globalIdx }) => {
                const isAnswered = Boolean(answers[q.id]);
                const isMarked = markedForReview.has(q.id);
                return (
                  <div
                    key={q.id}
                    id={`question_card_${q.id}`}
                    className={`bg-white rounded-2xl p-5 md:p-6 border transition-all scroll-mt-24 shadow-xs ${
                      isMarked
                        ? 'border-amber-300 ring-2 ring-amber-100'
                        : isAnswered
                        ? 'border-blue-200'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-extrabold shrink-0 shadow-xs">
                          {globalIdx + 1}
                        </span>
                        <div className="text-xs text-slate-500 font-semibold">
                          {effectiveSections.length > 1 && (
                            <span className="mr-2 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
                              {currentSection.title}
                            </span>
                          )}
                          {currentSection.isTieBreaker || q.points === 0 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                              Câu hỏi phụ (Xét khi bằng điểm)
                            </span>
                          ) : (
                            <span>Điểm: {q.points}đ</span>
                          )}
                          {q.difficulty && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                              {q.difficulty === 'easy' ? 'Cơ bản' : q.difficulty === 'medium' ? 'Nâng cao' : 'Thử thách'}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleMarkForReview(q.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isMarked
                            ? 'bg-amber-100 text-amber-800'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isMarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                        <span>{isMarked ? 'Đã đánh dấu' : 'Xem lại sau'}</span>
                      </button>
                    </div>

                    {/* Question Content / LaTeX */}
                    <div className="text-sm md:text-base text-slate-900 leading-relaxed font-normal">
                      <MathView content={q.content} />
                    </div>

                    {/* Circuit Schematic / Diagram Image */}
                    {q.imageUrl && (
                      <div className="mt-4 mb-3">
                        <div
                          className="relative inline-block border border-slate-200 rounded-xl overflow-hidden cursor-pointer group bg-slate-50"
                          onClick={() => setLightboxImage({ src: q.imageUrl!, caption: q.imageCaption })}
                        >
                          <img
                            src={q.imageUrl}
                            alt={`Sơ đồ câu ${globalIdx + 1}`}
                            className="max-h-60 max-w-full object-contain rounded-lg group-hover:opacity-95 transition-opacity"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                            <ZoomIn className="w-4 h-4" />
                            <span>Phóng to sơ đồ</span>
                          </div>
                        </div>
                        {q.imageCaption && (
                          <p className="text-xs text-slate-500 mt-1 italic">{q.imageCaption}</p>
                        )}
                      </div>
                    )}

                    {/* Choices (A, B, C, D) */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {q.options.map((opt) => {
                        const isSelected = answers[q.id] === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectOption(q.id, opt.id)}
                            className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/80'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-700 border border-slate-300'
                              }`}
                            >
                              {opt.id}
                            </span>
                            <div className="flex-1 text-sm pt-0.5">
                              <MathView content={opt.text} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* End of Section Transition Card (Hết Phần 1 -> Sang Phần 2) */}
              {effectiveSections.length > 1 && (
                <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-blue-700">
                      Kết thúc {currentSection.title}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {activeSectionIndex < effectiveSections.length - 1
                        ? `Bạn đã hoàn thành ${currentSectionQuestions.filter(({ q }) => Boolean(answers[q.id])).length}/${currentSectionQuestions.length} câu của ${currentSection.title}. Tiếp tục sang ${effectiveSections[activeSectionIndex + 1].title}?`
                        : `Bạn đang ở phần cuối cùng (${currentSection.title}) của đề thi.`}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {activeSectionIndex > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSelectSection(activeSectionIndex - 1)}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Quay lại {effectiveSections[activeSectionIndex - 1].title}</span>
                      </button>
                    )}

                    {activeSectionIndex < effectiveSections.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => handleSelectSection(activeSectionIndex + 1)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <span>Chuyển sang {effectiveSections[activeSectionIndex + 1].title}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowConfirmSubmit(true)}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>Hoàn thành &amp; Nộp bài thi</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* SINGLE QUESTION VIEW */
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[500px]">
              {(() => {
                const q = displayQuestions[currentSingleIndex];
                if (!q) return null;
                const isMarked = markedForReview.has(q.id);
                const qSec = effectiveSections.find((s) => s.id === q.sectionId) || currentSection;

                return (
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-base font-extrabold shrink-0 shadow-xs">
                          {currentSingleIndex + 1}
                        </span>
                        <div>
                          {effectiveSections.length > 1 && (
                            <span className="mr-2 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold">
                              {qSec.title}
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-700">
                            Câu {currentSingleIndex + 1} / {displayQuestions.length}
                          </span>
                          {qSec.isTieBreaker || q.points === 0 ? (
                            <span className="ml-2 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                              Câu hỏi phụ (Xét khi bằng điểm)
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 ml-2">({q.points} điểm)</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleMarkForReview(q.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isMarked
                            ? 'bg-amber-100 text-amber-800'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <Bookmark className={`w-4 h-4 ${isMarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                        <span>{isMarked ? 'Đã đánh dấu xem lại' : 'Đánh dấu câu này'}</span>
                      </button>
                    </div>

                    <div className="text-base text-slate-900 leading-relaxed">
                      <MathView content={q.content} />
                    </div>

                    {q.imageUrl && (
                      <div className="mt-4 mb-4">
                        <div
                          className="relative inline-block border border-slate-200 rounded-xl overflow-hidden cursor-pointer group bg-slate-50"
                          onClick={() => setLightboxImage({ src: q.imageUrl!, caption: q.imageCaption })}
                        >
                          <img
                            src={q.imageUrl}
                            alt={`Sơ đồ câu ${currentSingleIndex + 1}`}
                            className="max-h-72 max-w-full object-contain rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                            <ZoomIn className="w-4 h-4" />
                            <span>Phóng to sơ đồ</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 space-y-3">
                      {q.options.map((opt) => {
                        const isSelected = answers[q.id] === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectOption(q.id, opt.id)}
                            className={`w-full p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-700 border border-slate-300'
                              }`}
                            >
                              {opt.id}
                            </span>
                            <div className="flex-1 text-sm md:text-base pt-0.5">
                              <MathView content={opt.text} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  disabled={currentSingleIndex === 0}
                  onClick={() => {
                    const prevIdx = Math.max(0, currentSingleIndex - 1);
                    setCurrentSingleIndex(prevIdx);
                    const prevQ = displayQuestions[prevIdx];
                    if (prevQ && effectiveSections.length > 1) {
                      const sIdx = effectiveSections.findIndex((s) => s.id === prevQ.sectionId);
                      if (sIdx !== -1) setActiveSectionIndex(sIdx);
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>

                <div className="text-xs text-slate-500 font-semibold">
                  Câu {currentSingleIndex + 1} / {displayQuestions.length}
                </div>

                <button
                  type="button"
                  disabled={currentSingleIndex === displayQuestions.length - 1}
                  onClick={() => {
                    const nextIdx = Math.min(displayQuestions.length - 1, currentSingleIndex + 1);
                    setCurrentSingleIndex(nextIdx);
                    const nextQ = displayQuestions[nextIdx];
                    if (nextQ && effectiveSections.length > 1) {
                      const sIdx = effectiveSections.findIndex((s) => s.id === nextQ.sectionId);
                      if (sIdx !== -1) setActiveSectionIndex(sIdx);
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>
                    {(() => {
                      const curQ = displayQuestions[currentSingleIndex];
                      const nxtQ = displayQuestions[currentSingleIndex + 1];
                      if (curQ && nxtQ && curQ.sectionId !== nxtQ.sectionId) {
                        const nxtSec = effectiveSections.find((s) => s.id === nxtQ.sectionId);
                        return nxtSec ? `Sang ${nxtSec.title}` : 'Câu tiếp theo';
                      }
                      return 'Câu tiếp theo';
                    })()}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Right Column: Sticky Answer Sheet (Phiếu Trắc Nghiệm) */}
        <aside className="w-full lg:w-80 shrink-0">
          <div className="sticky top-20 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>Phiếu trả lời trắc nghiệm</span>
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                {answeredCount}/{displayQuestions.length} câu
              </span>
            </div>

            {/* Answer Progress bar */}
            <div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(answeredCount / displayQuestions.length) * 100}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium mt-1.5">
                <span>Tiến độ làm bài</span>
                <span>{Math.round((answeredCount / displayQuestions.length) * 100)}%</span>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-blue-600 shrink-0" />
                <span>Đã làm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-amber-400 shrink-0" />
                <span>Xem lại</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300 shrink-0" />
                <span>Chưa làm</span>
              </div>
            </div>

            {/* Questions Grid Jump buttons grouped by Section */}
            <div className="space-y-3 max-h-80 overflow-y-auto p-1 pr-1.5">
              {effectiveSections.map((sec, sIdx) => {
                const secItems = displayQuestions
                  .map((q, idx) => ({ q, idx }))
                  .filter((item) => item.q.sectionId === sec.id);

                return (
                  <div key={sec.id} className="space-y-1.5">
                    {effectiveSections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleSelectSection(sIdx)}
                        className={`w-full text-left px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center justify-between transition-colors cursor-pointer ${
                          sIdx === activeSectionIndex
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span>{sec.title}</span>
                        <span>
                          {secItems.filter(({ q }) => Boolean(answers[q.id])).length}/{secItems.length} câu
                        </span>
                      </button>
                    )}

                    <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2">
                      {secItems.map(({ q, idx }) => {
                        const isAnswered = Boolean(answers[q.id]);
                        const isMarked = markedForReview.has(q.id);
                        const isCurrentInSingle = viewMode === 'single' && currentSingleIndex === idx;

                        let btnClass = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200';
                        if (isMarked) {
                          btnClass = 'bg-amber-400 text-slate-900 font-bold border-amber-500 shadow-xs';
                        } else if (isAnswered) {
                          btnClass = 'bg-blue-600 text-white font-bold border-blue-700 shadow-xs';
                        }

                        if (isCurrentInSingle) {
                          btnClass += ' ring-2 ring-slate-900 ring-offset-1';
                        }

                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => scrollToQuestion(q.id, idx)}
                            className={`h-9 rounded-xl text-xs transition-all flex flex-col items-center justify-center relative cursor-pointer ${btnClass}`}
                          >
                            <span>{idx + 1}</span>
                            {isAnswered && (
                              <span className="text-[9px] opacity-90 leading-none">
                                {answers[q.id]}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Submit Action Box */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(true)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Nộp bài thi</span>
              </button>

              <div className="text-[11px] text-center text-slate-400">
                🔒 Cố định Fullscreen được giám sát bởi BTC ELABS
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Lightbox for zooming diagrams */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.src}
          caption={lightboxImage.caption}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* Confirm Submission Modal */}
      {showConfirmSubmit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận nộp bài thi"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận nộp bài thi ELABS?</h3>
                <p className="text-xs text-slate-500">Sau khi nộp, hệ thống sẽ kết thúc lượt thi và ghi nhận kết quả</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Tổng số câu hỏi:</span>
                <strong className="text-slate-900">{displayQuestions.length} câu</strong>
              </div>
              <div className="flex justify-between">
                <span>Số câu đã làm:</span>
                <strong className="text-emerald-600">{answeredCount} câu</strong>
              </div>
              <div className="flex justify-between">
                <span>Số câu chưa làm:</span>
                <strong className={unansweredCount > 0 ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                  {unansweredCount} câu
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Số lần vi phạm toàn màn hình:</span>
                <strong className={tabSwitchCount > 0 ? 'text-red-600' : 'text-emerald-600'}>
                  {tabSwitchCount} lần
                </strong>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                ⚠️ Chú ý: Bạn vẫn còn <strong>{unansweredCount} câu</strong> chưa chọn đáp án.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Tiếp tục làm bài
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmSubmit(false);
                  handleFinalSubmit(false);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Đồng ý nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
