import React, { useState, useMemo } from 'react';
import { Exam, CandidateAttempt, getExamCandidateFields } from '../../types/exam';
import { calculateExamAnalytics } from '../../utils/scoring';
import {
  Download,
  Search,
  BarChart2,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Trash2,
  Users,
  User,
  Trophy,
  X
} from 'lucide-react';

interface BtcSubmissionsViewProps {
  exam: Exam;
  allExams?: Exam[];
  attempts: CandidateAttempt[];
  onClearExamAttempts?: (targetId?: string) => Promise<void> | void;
  onClose: () => void;
}

interface AggregatedTeamRow {
  teamKey: string;
  teamName: string;
  attempts: CandidateAttempt[];
  memberCount: number;
  totalScore: number;
  avgScore: number;
  totalMainCorrect: number;
  totalMainQuestions: number;
  totalTieCorrect: number;
  totalTieQuestions: number;
  totalTimeSpentSeconds: number;
  totalTabSwitchCount: number;
}

export const BtcSubmissionsView: React.FC<BtcSubmissionsViewProps> = ({
  exam,
  allExams = [],
  attempts,
  onClearExamAttempts,
  onClose
}) => {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [leaderboardMode, setLeaderboardMode] = useState<'team' | 'individual'>('team');
  const [mergeAllExams, setMergeAllExams] = useState<boolean>(false);
  const [inspectAttempt, setInspectAttempt] = useState<CandidateAttempt | null>(null);
  const [inspectTeam, setInspectTeam] = useState<AggregatedTeamRow | null>(null);

  // Clear scoreboard state
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [clearTarget, setClearTarget] = useState<'current' | 'all'>('current');
  const [clearSuccessMsg, setClearSuccessMsg] = useState<string | null>(null);

  const handleExecuteClear = async () => {
    if (!onClearExamAttempts) return;
    setIsClearing(true);
    try {
      await onClearExamAttempts(clearTarget === 'all' ? 'all' : exam.id);
      setShowClearConfirm(false);
      setClearSuccessMsg(
        clearTarget === 'all'
          ? 'Đã xóa toàn bộ bài nộp của tất cả đề thi thành công!'
          : `Đã xóa toàn bộ bài nộp của đề thi ${exam.title}!`
      );
      setTimeout(() => setClearSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Lỗi khi xóa bảng điểm:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const enabledCandidateFields = useMemo(() => {
    return getExamCandidateFields(exam).filter((f) => f.enabled);
  }, [exam]);

  // Default grouping field: field marked isTeamGroupField -> first dropdown ('select') -> 'className' -> 'fullName'
  const defaultGroupFieldId = useMemo(() => {
    const teamField = enabledCandidateFields.find((f) => f.isTeamGroupField);
    if (teamField) return teamField.id;
    const selectField = enabledCandidateFields.find((f) => f.type === 'select');
    if (selectField) return selectField.id;
    const classField = enabledCandidateFields.find((f) => f.id === 'className');
    if (classField) return classField.id;
    return enabledCandidateFields[0]?.id || 'fullName';
  }, [enabledCandidateFields]);

  const [groupByFieldId, setGroupByFieldId] = useState<string>(defaultGroupFieldId);

  const getFieldValue = (att: CandidateAttempt, fieldId: string): string => {
    if (att.candidateInfo.customFields && att.candidateInfo.customFields[fieldId] !== undefined) {
      return att.candidateInfo.customFields[fieldId];
    }
    if (fieldId === 'fullName') return att.candidateInfo.fullName || '';
    if (fieldId === 'candidateCode') return att.candidateInfo.candidateCode || '';
    if (fieldId === 'className') return att.candidateInfo.className || '';
    if (fieldId === 'phone') return att.candidateInfo.phone || '';
    return '';
  };

  const getTeamNameForAttempt = (att: CandidateAttempt): string => {
    const chosen = getFieldValue(att, groupByFieldId).trim();
    if (chosen && chosen !== '-') return chosen;
    const fallbackClass = (att.candidateInfo.className || '').trim();
    if (fallbackClass && fallbackClass !== '-') return fallbackClass;
    return (att.candidateInfo.fullName || 'Chưa rõ đội').trim();
  };

  const examsMap = useMemo(() => {
    const map = new Map<string, Exam>();
    map.set(exam.id, exam);
    allExams.forEach((e) => map.set(e.id, e));
    return map;
  }, [exam, allExams]);

  const examAttempts = useMemo(() => {
    return attempts.filter(
      (a) => a.isSubmitted && (mergeAllExams ? examsMap.has(a.examId) : a.examId === exam.id)
    );
  }, [attempts, exam.id, mergeAllExams, examsMap]);

  const analytics = useMemo(() => {
    return calculateExamAnalytics(exam, examAttempts);
  }, [exam, examAttempts]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    examAttempts.forEach((a) => {
      const teamOrClass = getTeamNameForAttempt(a);
      if (teamOrClass && teamOrClass !== '-') {
        set.add(teamOrClass);
      }
    });
    return Array.from(set);
  }, [examAttempts, groupByFieldId]);

  // Helper to compute main & tie-breaker stats for an attempt across its exam
  const getAttemptBreakdown = (att: CandidateAttempt) => {
    const targetExam = examsMap.get(att.examId) || exam;
    const secTieMap = new Map<string, boolean>();
    (targetExam.sections || []).forEach((s) => {
      secTieMap.set(s.id, Boolean(s.isTieBreaker || s.totalPoints === 0));
    });

    let examMainTotal = 0;
    let examTieTotal = 0;
    targetExam.questions.forEach((q) => {
      const isTie = Boolean((q.sectionId && secTieMap.get(q.sectionId)) || q.points === 0);
      if (isTie) examTieTotal++;
      else examMainTotal++;
    });

    if (
      typeof att.mainCorrectCount === 'number' &&
      typeof att.tieBreakerCorrectCount === 'number'
    ) {
      return {
        mainCorrect: att.mainCorrectCount,
        mainTotal: att.mainTotalQuestions ?? examMainTotal,
        tieCorrect: att.tieBreakerCorrectCount,
        tieTotal: att.tieBreakerTotalQuestions ?? examTieTotal
      };
    }

    let mainCorrect = 0;
    let tieCorrect = 0;
    targetExam.questions.forEach((q) => {
      const isTie = Boolean((q.sectionId && secTieMap.get(q.sectionId)) || q.points === 0);
      const ans = att.answers[q.id];
      const isCorrect =
        Boolean(ans) && ans.trim().toUpperCase() === q.correctOptionId.trim().toUpperCase();
      if (isCorrect) {
        if (isTie) tieCorrect++;
        else mainCorrect++;
      }
    });
    return {
      mainCorrect,
      mainTotal: examMainTotal,
      tieCorrect,
      tieTotal: examTieTotal
    };
  };

  const examQuestionBreakdown = useMemo(() => {
    const secTieMap = new Map<string, boolean>();
    (exam.sections || []).forEach((s) => {
      secTieMap.set(s.id, Boolean(s.isTieBreaker || s.totalPoints === 0));
    });
    let mainTotal = 0;
    let tieTotal = 0;
    exam.questions.forEach((q) => {
      const isTie = Boolean((q.sectionId && secTieMap.get(q.sectionId)) || q.points === 0);
      if (isTie) tieTotal++;
      else mainTotal++;
    });
    const anyAttemptHasTie = examAttempts.some((a) => (a.tieBreakerTotalQuestions || 0) > 0);
    return { mainTotal, tieTotal, hasTieBreaker: tieTotal > 0 || anyAttemptHasTie };
  }, [exam, examAttempts]);

  // Individual sorted attempts
  const filteredAttempts = useMemo(() => {
    return examAttempts
      .filter((a) => {
        const teamOrClass = getTeamNameForAttempt(a);
        const matchClass = selectedClass === 'all' || teamOrClass === selectedClass;
        const q = search.toLowerCase();
        const matchSearch =
          a.candidateInfo.fullName.toLowerCase().includes(q) ||
          a.candidateInfo.candidateCode.toLowerCase().includes(q) ||
          teamOrClass.toLowerCase().includes(q);
        return matchClass && matchSearch;
      })
      .sort((a, b) => {
        // 1. Primary sort: Main Score DESC
        const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
        if (Math.abs(scoreDiff) > 0.001) return scoreDiff;

        // 1b. Main questions correct DESC
        const breakA = getAttemptBreakdown(a);
        const breakB = getAttemptBreakdown(b);
        if (breakB.mainCorrect !== breakA.mainCorrect) {
          return breakB.mainCorrect - breakA.mainCorrect;
        }

        // 2. Secondary sort (Tie-breaker): Auxiliary / Tie-breaker questions correct DESC (10 câu phụ)
        if (breakB.tieCorrect !== breakA.tieCorrect) {
          return breakB.tieCorrect - breakA.tieCorrect;
        }

        // 3. Tertiary sort: Faster completion time ASC
        return (a.timeSpentSeconds || 0) - (b.timeSpentSeconds || 0);
      });
  }, [examAttempts, search, selectedClass, groupByFieldId]);

  // Team Merged Leaderboard: Gộp chung kết quả của các bài nộp cùng Đội thi rồi xếp hạng (50 chính -> 10 phụ -> thời gian)
  const aggregatedTeams = useMemo<AggregatedTeamRow[]>(() => {
    const groups = new Map<string, AggregatedTeamRow>();

    examAttempts.forEach((att) => {
      const displayTeamName = getTeamNameForAttempt(att);
      const normalizedKey = displayTeamName.toLowerCase().trim() || 'unknown';
      const bd = getAttemptBreakdown(att);

      const existing = groups.get(normalizedKey);
      if (!existing) {
        groups.set(normalizedKey, {
          teamKey: normalizedKey,
          teamName: displayTeamName,
          attempts: [att],
          memberCount: 1,
          totalScore: +(att.score ?? 0).toFixed(2),
          avgScore: +(att.score ?? 0).toFixed(2),
          totalMainCorrect: bd.mainCorrect,
          totalMainQuestions: bd.mainTotal,
          totalTieCorrect: bd.tieCorrect,
          totalTieQuestions: bd.tieTotal,
          totalTimeSpentSeconds: att.timeSpentSeconds || 0,
          totalTabSwitchCount: att.tabSwitchCount || 0
        });
      } else {
        existing.attempts.push(att);
        existing.memberCount += 1;
        existing.totalScore = +(existing.totalScore + (att.score ?? 0)).toFixed(2);
        existing.avgScore = +(existing.totalScore / existing.memberCount).toFixed(2);
        existing.totalMainCorrect += bd.mainCorrect;
        existing.totalMainQuestions += bd.mainTotal;
        existing.totalTieCorrect += bd.tieCorrect;
        existing.totalTieQuestions += bd.tieTotal;
        existing.totalTimeSpentSeconds += att.timeSpentSeconds || 0;
        existing.totalTabSwitchCount += att.tabSwitchCount || 0;
      }
    });

    const list = Array.from(groups.values()).filter((team) => {
      const matchClass = selectedClass === 'all' || team.teamName === selectedClass;
      const q = search.toLowerCase();
      const matchTeamName = team.teamName.toLowerCase().includes(q);
      const matchMember = team.attempts.some(
        (a) =>
          a.candidateInfo.fullName.toLowerCase().includes(q) ||
          a.candidateInfo.candidateCode.toLowerCase().includes(q)
      );
      return matchClass && (matchTeamName || matchMember);
    });

    // Sort Team Leaderboard:
    // 1. Tổng Điểm chính (50 câu chính) DESC
    // 2. Tổng số câu chính đúng DESC
    // 3. Tổng số câu phụ đúng (10 câu phụ - chỉ xét khi bằng điểm chính) DESC
    // 4. Tổng thời gian làm bài ASC (nhanh hơn xếp trên)
    list.sort((a, b) => {
      const scoreDiff = b.totalScore - a.totalScore;
      if (Math.abs(scoreDiff) > 0.001) return scoreDiff;

      if (b.totalMainCorrect !== a.totalMainCorrect) {
        return b.totalMainCorrect - a.totalMainCorrect;
      }

      if (b.totalTieCorrect !== a.totalTieCorrect) {
        return b.totalTieCorrect - a.totalTieCorrect;
      }

      return a.totalTimeSpentSeconds - b.totalTimeSpentSeconds;
    });

    return list;
  }, [examAttempts, search, selectedClass, groupByFieldId]);

  // Export to CSV (supports both Team Merged Leaderboard and Individual Leaderboard)
  const handleExportCSV = () => {
    if (leaderboardMode === 'team') {
      const headers = [
        'Hạng Đội',
        'Tên Đội thi',
        'Số bài nộp gộp',
        'Danh sách thành viên (Điểm cá nhân)',
        'Tổng Điểm chính (Gộp)',
        'Điểm Trung bình Đội',
        'Tổng Câu chính đúng (50 câu chính)',
        'Tổng Câu phụ đúng (10 câu phụ - Xét bằng điểm)',
        'Tổng Thời gian (giây)',
        'Tổng Lượt rời tab'
      ];
      const rows = aggregatedTeams.map((team, idx) => {
        const membersSummary = team.attempts
          .map((a) => `${a.candidateInfo.fullName} (${a.score ?? 0}đ)`)
          .join(' | ');
        return [
          idx + 1,
          `"${team.teamName.replace(/"/g, '""')}"`,
          team.memberCount,
          `"${membersSummary.replace(/"/g, '""')}"`,
          team.totalScore,
          team.avgScore,
          `"${team.totalMainCorrect}/${team.totalMainQuestions}"`,
          `"${team.totalTieCorrect}/${team.totalTieQuestions}"`,
          team.totalTimeSpentSeconds,
          team.totalTabSwitchCount
        ];
      });
      const csvContent =
        '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `BXH_Gop_Doi_${exam.code}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const headers = [
      'Hạng',
      ...enabledCandidateFields.map((f) => f.label),
      'Điểm chính',
      'Câu chính đúng',
      'Câu phụ đúng (Xét bằng điểm)',
      'Tổng câu đúng',
      'Thời gian (giây)',
      'Số lần rời tab',
      'Ngày nộp'
    ];
    const rows = filteredAttempts.map((a, idx) => {
      const bd = getAttemptBreakdown(a);
      return [
        idx + 1,
        ...enabledCandidateFields.map(
          (f) => `"${(getFieldValue(a, f.id) || '').replace(/"/g, '""')}"`
        ),
        a.score ?? 0,
        `"${bd.mainCorrect}/${bd.mainTotal}"`,
        `"${bd.tieCorrect}/${bd.tieTotal}"`,
        `"${a.correctCount ?? 0}/${bd.mainTotal + bd.tieTotal}"`,
        a.timeSpentSeconds,
        a.tabSwitchCount,
        `"${new Date(a.submittedAt || a.startedAt).toLocaleString('vi-VN')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bang_diem_Ca_nhan_${exam.code}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 inline-flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            <span>Bảng xếp hạng Gộp Đội &amp; Thống kê Điểm thi</span>
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1.5">
            {mergeAllExams ? 'Tổng hợp Tất cả Đề thi ELABS' : `${exam.title} (Mã: ${exam.code})`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng cộng: <strong>{aggregatedTeams.length} đội thi</strong> ({examAttempts.length} lượt nộp bài) • Quy tắc xếp hạng:{' '}
            <strong>Ưu tiên Tổng điểm chính (50 câu chính) &rarr; Câu hỏi phụ (10 câu phụ) &rarr; Thời gian nhanh nhất</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onClearExamAttempts && examAttempts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Xóa toàn bộ bài nộp của bảng điểm này"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa bảng điểm</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>
              {leaderboardMode === 'team'
                ? 'Xuất Excel / CSV (BXH Đội)'
                : 'Xuất Excel / CSV (Cá nhân)'}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Clear Success Alert */}
      {clearSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{clearSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setClearSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mode Switcher: Team Merged Leaderboard vs Individual Leaderboard */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-indigo-50/60 border border-indigo-200/80 p-3.5 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLeaderboardMode('team')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              leaderboardMode === 'team'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>🏆 Bảng xếp hạng Gộp chung theo Đội thi ({aggregatedTeams.length} đội)</span>
          </button>

          <button
            type="button"
            onClick={() => setLeaderboardMode('individual')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              leaderboardMode === 'individual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>👤 Danh sách từng bài nộp cá nhân ({examAttempts.length} bài)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Gộp Đội theo trường:</span>
            <select
              value={groupByFieldId}
              onChange={(e) => {
                setGroupByFieldId(e.target.value);
                setSelectedClass('all');
              }}
              className="px-2.5 py-1.5 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              {enabledCandidateFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {allExams.length > 1 && (
            <label className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={mergeAllExams}
                onChange={(e) => setMergeAllExams(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Gộp kết quả từ tất cả đề thi ({allExams.length} đề)</span>
            </label>
          )}
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
          <div className="text-xs text-slate-500 font-medium">Số Đội thi có bài nộp</div>
          <div className="text-2xl font-black text-indigo-600">{aggregatedTeams.length} đội</div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
          <div className="text-xs text-slate-500 font-medium">Tổng điểm Đội cao nhất</div>
          <div className="text-2xl font-black text-emerald-600">
            {aggregatedTeams[0] ? `${aggregatedTeams[0].totalScore}đ` : '0đ'}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
          <div className="text-xs text-slate-500 font-medium">Điểm trung bình bài thi</div>
          <div className="text-2xl font-black text-blue-600">{analytics.averageScore}đ</div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
          <div className="text-xs text-slate-500 font-medium">Tổng số lượt nộp bài</div>
          <div className="text-2xl font-black text-slate-900">{examAttempts.length} lượt</div>
        </div>
      </div>

      {/* Score Histogram (Phổ điểm) */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <BarChart2 className="w-4 h-4 text-blue-600" />
            <span>Biểu đồ Phổ Điểm (Score Distribution)</span>
          </h3>
          <span className="text-[11px] text-slate-500">
            Xếp hạng tự động: Ưu tiên Điểm chính (50 câu chính) &rarr; Câu phụ (10 câu phụ) &rarr; Thời gian
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2 items-end pt-4 pb-2">
          {analytics.scoreDistribution.map((bin) => {
            const maxCount = Math.max(1, ...analytics.scoreDistribution.map((b) => b.count));
            const barHeightPct = (bin.count / maxCount) * 100;
            return (
              <div key={bin.range} className="flex flex-col items-center gap-1.5 text-center">
                <span className="text-xs font-bold text-slate-700">{bin.count}</span>
                <div className="w-full bg-slate-200 rounded-lg h-20 flex items-end overflow-hidden p-1">
                  <div
                    className="w-full bg-blue-600 hover:bg-blue-700 rounded-md transition-all duration-300"
                    style={{ height: `${Math.max(8, barHeightPct)}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-slate-600 leading-tight">
                  {bin.range}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên Đội thi, tên thành viên, MSSV..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Lọc Đội thi:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Tất cả Đội thi ({uniqueClasses.length} đội)</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLE 1: TEAM MERGED LEADERBOARD */}
        {leaderboardMode === 'team' ? (
          <div className="overflow-x-auto rounded-xl border border-indigo-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-indigo-50/80 text-indigo-950 font-bold border-b border-indigo-200">
                <tr>
                  <th className="py-3.5 px-3 text-center">Hạng</th>
                  <th className="py-3.5 px-3">Tên Đội thi (Gộp kết quả)</th>
                  <th className="py-3.5 px-3">Thành viên đã nộp bài</th>
                  <th className="py-3.5 px-3">Tổng Điểm chính</th>
                  <th className="py-3.5 px-3">Câu chính đúng (Ưu tiên 1)</th>
                  <th className="py-3.5 px-3">Câu phụ đúng (Xét khi bằng điểm)</th>
                  <th className="py-3.5 px-3">Tổng Thời gian</th>
                  <th className="py-3.5 px-3">Rời tab</th>
                  <th className="py-3.5 px-4 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aggregatedTeams.map((team, idx) => {
                  const mins = Math.floor(team.totalTimeSpentSeconds / 60);
                  const secs = team.totalTimeSpentSeconds % 60;
                  return (
                    <tr key={team.teamKey} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="py-3.5 px-3 text-center font-black text-slate-800 text-sm">
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-black text-indigo-950 text-sm">{team.teamName}</div>
                        <div className="text-[11px] text-slate-500">
                          Đã gộp <strong>{team.memberCount} bài nộp</strong> • TB: {team.avgScore}đ/bài
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {team.attempts.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => setInspectAttempt(a)}
                              className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Bấm để xem bài làm của thành viên này"
                            >
                              {a.candidateInfo.fullName} ({a.score ?? 0}đ)
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-black text-blue-700 text-base">
                          {team.totalScore}đ
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                          {team.totalMainCorrect}/{team.totalMainQuestions} câu chính
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                          {team.totalTieCorrect}/{team.totalTieQuestions} câu phụ
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-600 font-semibold">
                        {mins}p {secs}s
                      </td>
                      <td className="py-3.5 px-3">
                        {team.totalTabSwitchCount > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                            {team.totalTabSwitchCount} lần
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setInspectTeam(team)}
                          className="px-3 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Xem {team.memberCount} bài
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {aggregatedTeams.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Chưa có Đội thi nào nộp bài trong tiêu chí tìm kiếm này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TABLE 2: INDIVIDUAL SUBMISSIONS TABLE */
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center">Hạng</th>
                  {enabledCandidateFields.map((field) => (
                    <th key={field.id} className="py-3 px-3">
                      {field.label}
                    </th>
                  ))}
                  <th className="py-3 px-3">Điểm chính</th>
                  <th className="py-3 px-3">Câu chính đúng</th>
                  {examQuestionBreakdown.hasTieBreaker && (
                    <th className="py-3 px-3">Câu phụ (Xét bằng điểm)</th>
                  )}
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3">Rời tab</th>
                  <th className="py-3 px-4 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAttempts.map((att, idx) => {
                  const mins = Math.floor(att.timeSpentSeconds / 60);
                  const secs = att.timeSpentSeconds % 60;
                  const bd = getAttemptBreakdown(att);
                  return (
                    <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                      </td>
                      {enabledCandidateFields.map((field, fIdx) => (
                        <td
                          key={field.id}
                          className={`py-3 px-3 ${
                            fIdx === 0
                              ? 'font-bold text-slate-900'
                              : field.id === 'candidateCode'
                              ? 'font-mono font-medium text-slate-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {getFieldValue(att, field.id) || '-'}
                        </td>
                      ))}
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-blue-700 text-sm">
                          {att.score}đ
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-semibold">
                        {bd.mainCorrect}/{bd.mainTotal} câu
                      </td>
                      {examQuestionBreakdown.hasTieBreaker && (
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                            {bd.tieCorrect}/{bd.tieTotal} câu phụ
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-3 font-mono text-slate-500">
                        <div>{mins}p {secs}s</div>
                        {att.status === 'timed_out' && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 font-bold border border-amber-200 mt-0.5">
                            Hết giờ
                          </span>
                        )}
                        {att.isDisqualified && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-700 font-bold border border-red-200 mt-0.5">
                            Đình chỉ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {att.tabSwitchCount > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                            {att.tabSwitchCount} lần
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setInspectAttempt(att)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          Chi tiết bài làm
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredAttempts.length === 0 && (
                  <tr>
                    <td
                      colSpan={
                        enabledCandidateFields.length +
                        (examQuestionBreakdown.hasTieBreaker ? 7 : 6)
                      }
                      className="py-8 text-center text-slate-400"
                    >
                      Chưa có bài thi nào nộp trong tiêu chí tìm kiếm này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Team Modal (Shows all merged member submissions in a team) */}
      {inspectTeam && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết các bài thi trong Đội"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase">
                  Tổng hợp kết quả Đội thi
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {inspectTeam.teamName}
                </h3>
              </div>
              <button
                onClick={() => setInspectTeam(null)}
                aria-label="Đóng chi tiết đội"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-200">
              <div>
                <span className="text-slate-500 block">Tổng Điểm chính:</span>
                <strong className="text-base text-indigo-700">{inspectTeam.totalScore}đ</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Tổng Câu chính đúng:</span>
                <strong className="text-sm text-emerald-700">
                  {inspectTeam.totalMainCorrect}/{inspectTeam.totalMainQuestions} câu
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Tổng Câu phụ đúng:</span>
                <strong className="text-sm text-amber-700">
                  {inspectTeam.totalTieCorrect}/{inspectTeam.totalTieQuestions} câu
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Số bài nộp đã gộp:</span>
                <strong className="text-sm text-slate-800">{inspectTeam.memberCount} bài</strong>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Danh sách từng bài thi trong Đội ({inspectTeam.memberCount} bài):
              </h4>
              <div className="space-y-2">
                {inspectTeam.attempts.map((att, idx) => {
                  const bd = getAttemptBreakdown(att);
                  const mins = Math.floor(att.timeSpentSeconds / 60);
                  const secs = att.timeSpentSeconds % 60;
                  return (
                    <div
                      key={att.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          #{idx + 1}. {att.candidateInfo.fullName}{' '}
                          {att.candidateInfo.candidateCode &&
                          att.candidateInfo.candidateCode !== '-'
                            ? `(${att.candidateInfo.candidateCode})`
                            : ''}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Điểm chính: <strong className="text-blue-700">{att.score}đ</strong> • Câu chính:{' '}
                          <strong>
                            {bd.mainCorrect}/{bd.mainTotal}
                          </strong>{' '}
                          • Câu phụ:{' '}
                          <strong className="text-amber-700">
                            {bd.tieCorrect}/{bd.tieTotal}
                          </strong>{' '}
                          • Thời gian: {mins}p {secs}s
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setInspectTeam(null);
                          setInspectAttempt(att);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        Xem đáp án bài này
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Attempt Modal */}
      {inspectAttempt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết bài thi thí sinh"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Bài làm: {inspectAttempt.candidateInfo.fullName}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                  {enabledCandidateFields.map((f) => {
                    const val = getFieldValue(inspectAttempt, f.id);
                    if (!val || val === '-') return null;
                    return (
                      <span key={f.id}>
                        <strong>{f.label}:</strong> {val}
                      </span>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => setInspectAttempt(null)}
                aria-label="Đóng chi tiết bài làm"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const bd = getAttemptBreakdown(inspectAttempt);
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-500 block">Điểm chính thức:</span>
                    <strong className="text-base text-blue-700">{inspectAttempt.score}đ</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Câu hỏi chính:</span>
                    <strong className="text-sm text-emerald-600">
                      {bd.mainCorrect}/{bd.mainTotal} câu
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Câu hỏi phụ (Xét bằng điểm):</span>
                    <strong className="text-sm text-amber-700">
                      {bd.tieCorrect}/{bd.tieTotal} câu
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Cảnh báo rời tab:</span>
                    <strong className={inspectAttempt.tabSwitchCount > 0 ? 'text-red-600' : 'text-slate-700'}>
                      {inspectAttempt.tabSwitchCount} lần
                    </strong>
                  </div>
                </div>
              );
            })()}

            {/* Answer audit */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Bảng đối chiếu đáp án chi tiết
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {(() => {
                  const targetExam = examsMap.get(inspectAttempt.examId) || exam;
                  const secTieMap = new Map<string, boolean>();
                  (targetExam.sections || []).forEach((s) => {
                    secTieMap.set(s.id, Boolean(s.isTieBreaker || s.totalPoints === 0));
                  });
                  return targetExam.questions.map((q) => {
                    const studentAns = inspectAttempt.answers[q.id];
                    const isCorrect = studentAns === q.correctOptionId;
                    const isTieQ = Boolean(
                      (q.sectionId && secTieMap.get(q.sectionId)) || q.points === 0
                    );
                    return (
                      <div
                        key={q.id}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                          isCorrect
                            ? 'border-emerald-200 bg-emerald-50/50'
                            : 'border-red-200 bg-red-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-700 shrink-0">Câu {q.number}:</span>
                          {isTieQ && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold shrink-0">
                              Câu phụ (0đ)
                            </span>
                          )}
                          <span className="text-slate-600 truncate max-w-xs">
                            {q.content.replace(/\$[^$]+\$/g, '[công thức]')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span>
                            Thí sinh:{' '}
                            <strong className="font-mono">{studentAns || 'Chưa làm'}</strong>
                          </span>
                          <span>
                            Đáp án đúng:{' '}
                            <strong className="font-mono text-emerald-700">
                              {q.correctOptionId}
                            </strong>
                          </span>
                          {isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Tab switch log if any */}
            {inspectAttempt.tabSwitchLogs && inspectAttempt.tabSwitchLogs.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Nhật ký vi phạm rời màn hình:</span>
                </span>
                <ul className="text-[11px] text-slate-600 space-y-0.5 max-h-24 overflow-y-auto pl-4 list-disc">
                  {inspectAttempt.tabSwitchLogs.map((log, i) => (
                    <li key={i}>{log.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Clear Scoreboard Modal */}
      {showClearConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận xóa bảng điểm"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận xóa bảng điểm</h3>
                <p className="text-xs text-slate-500">Xóa vĩnh viễn kết quả làm bài của thí sinh</p>
              </div>
            </div>

            <div className="p-4 bg-red-50/70 border border-red-200 rounded-2xl space-y-2 text-xs text-red-800">
              <p className="font-bold">⚠️ Cảnh báo thao tác quan trọng:</p>
              <p>
                Thao tác này sẽ xóa toàn bộ <strong>{examAttempts.length} bài nộp</strong> khỏi hệ thống đám mây Firestore và bộ nhớ cục bộ. Sau khi xóa, điểm số và bài làm của thí sinh sẽ không thể phục hồi.
              </p>
              {mergeAllExams && (
                <div className="pt-2 border-t border-red-200 space-y-1.5">
                  <span className="font-bold block text-slate-800">Phạm vi xóa bài nộp:</span>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="clearTarget"
                      checked={clearTarget === 'current'}
                      onChange={() => setClearTarget('current')}
                      className="accent-red-600"
                    />
                    <span>Chỉ xóa bài nộp của đề này ({exam.title})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="clearTarget"
                      checked={clearTarget === 'all'}
                      onChange={() => setClearTarget('all')}
                      className="accent-red-600"
                    />
                    <span>Xóa bài nộp của TẤT CẢ các đề thi</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={handleExecuteClear}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isClearing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Xác nhận xóa bảng điểm</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
