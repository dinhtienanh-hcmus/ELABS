import React, { useState, useRef } from 'react';
import { Exam, CandidateAttempt } from '../../types/exam';
import { OfficialLogos } from '../OfficialLogos';
import {
  Plus,
  FileText,
  Activity,
  Users,
  Award,
  BarChart3,
  Edit,
  Trash2,
  Copy,
  Check,
  Lock,
  Unlock,
  Cloud,
  RefreshCw,
  Download,
  Upload,
  Link2
} from 'lucide-react';

interface BtcDashboardProps {
  exams: Exam[];
  attempts: CandidateAttempt[];
  activeCount: number;
  cloudStatus?: 'syncing' | 'synced' | 'error';
  onForceSyncCloud?: () => Promise<void>;
  onImportExamsJson?: (importedExams: Exam[]) => void;
  onCreateExam: () => void;
  onEditExam: (exam: Exam) => void;
  onDeleteExam: (examId: string) => void;
  onResetAllData: () => void;
  onToggleExamStatus: (examId: string) => void;
  onOpenLiveMonitor: (exam: Exam) => void;
  onOpenSubmissions: (exam: Exam) => void;
}

export const BtcDashboard: React.FC<BtcDashboardProps> = ({
  exams,
  attempts,
  activeCount,
  cloudStatus = 'synced',
  onForceSyncCloud,
  onImportExamsJson,
  onCreateExam,
  onEditExam,
  onDeleteExam,
  onResetAllData,
  onToggleExamStatus,
  onOpenLiveMonitor,
  onOpenSubmissions
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validAttempts = attempts.filter(
    (a) => a.isSubmitted && exams.some((e) => e.id === a.examId)
  );
  const totalSubmissions = validAttempts.length;
  const averageScore =
    totalSubmissions > 0
      ? +(
          validAttempts.reduce((acc, a) => acc + (a.score ?? 0), 0) / totalSubmissions
        ).toFixed(2)
      : 0;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyExamLink = (code: string) => {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const examUrl = `${baseUrl}?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(examUrl);
    setCopiedLink(code);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleManualSync = async () => {
    if (!onForceSyncCloud) return;
    setIsManualSyncing(true);
    try {
      await onForceSyncCloud();
    } finally {
      setTimeout(() => setIsManualSyncing(false), 600);
    }
  };

  const handleExportExamsJson = () => {
    const dataStr = JSON.stringify(exams, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ELABS_2026_Exams_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportExamsJson) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || '[]'));
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const valid = list.filter((item) => item && item.id && item.code && Array.isArray(item.questions));
        if (valid.length > 0) {
          onImportExamsJson(valid);
        }
      } catch (err) {
        console.error('Invalid JSON exam file:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-in fade-in">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-amber-200/80 shadow-xs">
        <div className="space-y-2">
          {/* 4 Official Logos: Khoa -> Đoàn -> Hội -> ELABS */}
          <div className="inline-flex items-center px-3.5 py-1 bg-amber-50 rounded-2xl border border-amber-200/80 mb-1">
            <OfficialLogos size="sm" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-100 text-amber-900 border border-amber-200">
              Khu Vực Quản Lý Đề Thi
            </span>
            <span
              className={`px-2.5 py-1 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 border ${
                cloudStatus === 'synced'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : cloudStatus === 'syncing'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>
                {cloudStatus === 'synced'
                  ? 'Đã đồng bộ Đám mây (Mọi thiết bị / Tab ẩn danh đều thấy đề)'
                  : cloudStatus === 'syncing'
                  ? 'Đang đồng bộ lên Đám mây...'
                  : 'Đang kết nối lại Đám mây...'}
              </span>
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1.5 uppercase">
            CUỘC THI HỌC THUẬT{' '}
            <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 bg-clip-text text-transparent">
              ELABS LẦN THỨ XIX
            </span>{' '}
            - NĂM 2026
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Đề thi và bài nộp của thí sinh được đồng bộ trực tuyến thời gian thực trên mọi máy tính, điện thoại và tab ẩn danh
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJsonChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Khôi phục đề thi từ file .json"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Nhập file (.json)</span>
          </button>

          {exams.length > 0 && (
            <button
              type="button"
              onClick={handleExportExamsJson}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Tải xuống bản sao lưu toàn bộ đề thi (.json)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sao lưu (.json)</span>
            </button>
          )}

          {onForceSyncCloud && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isManualSyncing}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Đồng bộ tất cả đề thi lên máy chủ đám mây ngay lập tức"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
              <span>{isManualSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Cloud'}</span>
            </button>
          )}

          {(exams.length > 0 || attempts.length > 0) && (
            <button
              type="button"
              onClick={onResetAllData}
              className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Xóa toàn bộ đề thi và làm mới dữ liệu về 0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa tất cả &amp; Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCreateExam}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tạo đề thi TeX mới</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Tổng số đề thi</div>
            <div className="text-2xl font-black text-slate-900">{exams.length} đề</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Lượt nộp bài</div>
            <div className="text-2xl font-black text-slate-900">{totalSubmissions} lượt</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold relative">
            <Activity className="w-6 h-6" />
            {activeCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute top-2 right-2 animate-ping" />
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Đang thi trực tiếp</div>
            <div className="text-2xl font-black text-indigo-600">{activeCount} thí sinh</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Điểm số trung bình</div>
            <div className="text-2xl font-black text-slate-900">{averageScore}đ</div>
          </div>
        </div>
      </div>

      {/* Exams Management Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Danh sách đề thi của bạn</span>
            <span className="text-xs font-normal text-slate-500">({exams.length} đề thi)</span>
          </h2>
          <span className="text-xs text-slate-500">
            Mọi đề thi trạng thái &quot;Đang mở thi&quot; sẽ tự động hiển thị ở Cổng Thí Sinh
          </span>
        </div>

        {exams.length === 0 ? (
          <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Chưa có đề thi nào trong hệ thống
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Hãy bấm nút bên dưới để tải tệp .tex / .txt hoặc dán mã LaTeX tạo đề thi mới.
              </p>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={onCreateExam}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 inline-flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tạo đề thi TeX mới ngay</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map((exam) => {
              const examSubs = attempts.filter((a) => a.examId === exam.id && a.isSubmitted);
              const isClosed = exam.status === 'closed';

              return (
                <div
                  key={exam.id}
                  className="p-5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  {/* Left: Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {exam.sections && exam.sections.length > 0 && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {exam.sections.length} phần thi ({exam.sections.map((s) => s.title).join(', ')})
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyCode(exam.code)}
                        className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Nhấn để sao chép mã phòng thi"
                      >
                        <span>Mã: {exam.code}</span>
                        {copiedCode === exam.code ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyExamLink(exam.code)}
                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Sao chép đường dẫn trực tiếp vào phòng thi này gửi cho thí sinh"
                      >
                        {copiedLink === exam.code ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">Đã chép Link thi!</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3 h-3" />
                            <span>Copy Link gửi Thí sinh</span>
                          </>
                        )}
                      </button>

                      {isClosed ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Đã đóng
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Unlock className="w-3 h-3" /> Đang mở thi (Cloud)
                        </span>
                      )}
                      {exam.password && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Có mật khẩu
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {exam.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Thời gian: <strong>{exam.durationMinutes} phút</strong></span>
                      <span>•</span>
                      <span>Số câu: <strong>{exam.questions.length} câu</strong> ({exam.totalPoints}đ)</span>
                      <span>•</span>
                      <span>Lượt nộp: <strong className="text-blue-600">{examSubs.length} bài</strong></span>
                      <span>•</span>
                      <span>Hình vẽ: <strong>{exam.questions.filter((q) => q.imageUrl).length} hình</strong></span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <button
                      type="button"
                      onClick={() => onOpenLiveMonitor(exam)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Theo dõi thí sinh đang làm bài thời gian thực"
                    >
                      <Activity className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Giám sát trực tiếp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenSubmissions(exam)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Xem bảng điểm và phổ điểm"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Bảng điểm ({examSubs.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditExam(exam)}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      title="Sửa đề thi và câu hỏi"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleExamStatus(exam.id)}
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${
                        isClosed
                          ? 'text-emerald-600 hover:bg-emerald-50'
                          : 'text-amber-600 hover:bg-amber-50'
                      }`}
                      title={isClosed ? 'Mở lại đề thi' : 'Đóng / Khóa đề thi'}
                    >
                      {isClosed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteExam(exam.id)}
                      className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Xóa đề thi này và toàn bộ lượt nộp bài của đề"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
