import React, { useEffect, useState } from 'react';
import { CandidateAttempt, Exam } from '../../types/exam';
import { MathView } from '../MathView';
import { ImageLightbox } from '../ImageLightbox';
import { OfficialLogos } from '../OfficialLogos';
import confetti from 'canvas-confetti';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Check,
  ZoomIn,
  Lock,
  FileCheck
} from 'lucide-react';

interface ExamResultViewProps {
  exam: Exam;
  attempt: CandidateAttempt;
  onRetake: () => void;
  onBackToHome: () => void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({
  exam,
  attempt,
  onRetake,
  onBackToHome
}) => {
  const [lightboxImage, setLightboxImage] = useState<{ src: string; caption?: string } | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'wrong' | 'correct'>('all');

  const canShowScore = exam.settings?.showResultImmediately !== false;
  const score = attempt.score ?? 0;
  const isHighPerformer = canShowScore && score >= 8.0;

  useEffect(() => {
    if (isHighPerformer) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // ignore
      }
    }
  }, [isHighPerformer]);

  const minutesSpent = Math.floor(attempt.timeSpentSeconds / 60);
  const secondsSpent = attempt.timeSpentSeconds % 60;
  const answeredCount = Object.keys(attempt.answers || {}).length;
  const maxAttempts = exam.settings?.maxAttempts ?? 1;
  const canRetake = maxAttempts === 0 || maxAttempts > 1;

  const filteredQuestions = exam.questions.filter((q) => {
    const studentChoice = attempt.answers[q.id];
    const isCorrect = studentChoice?.toUpperCase() === q.correctOptionId.toUpperCase();
    if (filterMode === 'correct') return isCorrect;
    if (filterMode === 'wrong') return !isCorrect;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Disqualification Banner if violated fullscreen */}
      {attempt.isDisqualified && (
        <div className="p-5 bg-red-600 text-white rounded-3xl shadow-xl flex items-start gap-4 animate-bounce">
          <ShieldAlert className="w-8 h-8 shrink-0 text-amber-300 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-lg font-black uppercase tracking-wider">
              BÀI THI BỊ ĐÌNH CHỈ DO VI PHẠM CỐ ĐỊNH TOÀN MÀN HÌNH
            </h2>
            <p className="text-xs text-red-100 leading-relaxed font-medium">
              {attempt.disqualificationReason || 'Thí sinh đã vi phạm quy chế thi: thoát toàn màn hình hoặc chuyển tab quá số lần cho phép của Cuộc thi học thuật ELABS.'}
            </p>
          </div>
        </div>
      )}

      {/* Auto-submitted on Timeout Banner */}
      {attempt.status === 'timed_out' && (
        <div className="p-5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-3xl shadow-lg flex items-start gap-4">
          <Clock className="w-8 h-8 shrink-0 text-amber-100 mt-0.5" />
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-wide">
              <span>Nộp bài tự động khi hết giờ</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold">
              Bài thi đã được tự động nộp do hết thời gian làm bài ({exam.durationMinutes} phút)
            </h2>
            <p className="text-xs text-amber-50 leading-relaxed font-medium">
              {canShowScore
                ? 'Hệ thống đã tự động thu bài và bảo lưu toàn bộ câu trả lời bạn đã chọn. Kết quả và điểm số bên dưới đã được tính toán đầy đủ và chính xác dựa trên tiến trình bạn đã làm.'
                : 'Hệ thống đã tự động thu bài và bảo lưu an toàn toàn bộ các câu trả lời bạn đã chọn. Ban tổ chức sẽ chấm và công bố kết quả sau theo quy chế thi.'}
            </p>
          </div>
        </div>
      )}

      {/* When score is NOT published yet */}
      {!canShowScore && (
        <div className="p-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-200/90 text-slate-800 rounded-3xl shadow-xs flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">
                Bảo mật điểm thi
              </span>
              <span className="text-xs font-bold text-blue-900">
                Đề thi không công bố điểm ngay sau khi nộp
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Bài làm của bạn đã được ghi nhận và nộp thành công!
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Hệ thống đã mã hóa và lưu trữ an toàn toàn bộ <strong>{answeredCount}/{exam.questions.length}</strong> câu trả lời của bạn. Theo thiết lập của Ban tổ chức ELABS 2026, điểm số và kết quả chi tiết sẽ được công bố sau khi hoàn tất toàn bộ ca thi.
            </p>
          </div>
        </div>
      )}

      {/* Top Banner & Score Card */}
      <div className="bg-white rounded-3xl border border-amber-200/80 p-6 md:p-8 shadow-sm">
        {/* 4 Official Logos: Khoa -> Đoàn -> Hội -> ELABS */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-amber-100 flex-wrap gap-3">
          <div className="px-3 py-1 bg-amber-50 rounded-2xl border border-amber-200/80">
            <OfficialLogos size="sm" />
          </div>
          <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
            Khoa ĐT-VT • Trường ĐH Khoa học tự nhiên, ĐHQG-HCM
          </span>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-2">
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-50 text-amber-900 border border-amber-200 uppercase">
              {canShowScore ? 'Kết quả' : 'Xác nhận nộp bài'} • CUỘC THI HỌC THUẬT ELABS LẦN THỨ XIX - NĂM 2026
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
              {exam.title}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Thí sinh: <strong className="text-orange-700 font-bold">{attempt.candidateInfo.fullName}</strong> • MSSV: <strong className="font-mono text-slate-800">{attempt.candidateInfo.candidateCode}</strong> • Lớp: {attempt.candidateInfo.className}
            </p>
          </div>

          {/* Score or Status Badge */}
          {canShowScore ? (
            <div className={`flex flex-col items-center justify-center p-5 text-white rounded-2xl shadow-lg min-w-48 text-center shrink-0 ${
              attempt.isDisqualified
                ? 'bg-gradient-to-br from-red-600 to-rose-700 shadow-red-500/20'
                : 'bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 shadow-orange-500/25'
            }`}>
              <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                {attempt.isDisqualified ? 'Trạng thái bài thi' : 'Điểm số đạt được'}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-4xl md:text-5xl font-black tracking-tight">
                  {attempt.isDisqualified ? '0.0' : score}
                </span>
                <span className="text-base text-white/80 font-bold">/{exam.totalPoints}đ</span>
              </div>
              {attempt.isDisqualified ? (
                <span className="mt-2 text-[11px] font-bold px-2.5 py-0.5 bg-white/20 rounded-full text-white">
                  Đình chỉ thi
                </span>
              ) : attempt.status === 'timed_out' ? (
                <span className="mt-2 text-[11px] font-bold px-2.5 py-0.5 bg-white/30 text-white rounded-full flex items-center gap-1 shadow-xs">
                  <Clock className="w-3 h-3 text-white" />
                  <span>Hết giờ làm bài</span>
                </span>
              ) : isHighPerformer ? (
                <span className="mt-2 text-[11px] font-bold px-2.5 py-0.5 bg-white/25 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-yellow-200" />
                  <span>Xuất sắc</span>
                </span>
              ) : null}
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center p-5 text-white rounded-2xl shadow-lg min-w-52 text-center shrink-0 ${
              attempt.isDisqualified
                ? 'bg-gradient-to-br from-red-600 to-rose-700 shadow-red-500/20'
                : 'bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-500/20'
            }`}>
              <span className="text-xs font-semibold uppercase tracking-wider text-white/85">
                Trạng thái bài thi
              </span>
              <div className="flex items-center justify-center gap-2 mt-2 mb-1">
                {attempt.isDisqualified ? (
                  <ShieldAlert className="w-7 h-7 text-amber-300 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-7 h-7 text-emerald-200 shrink-0" />
                )}
                <span className="text-2xl font-black tracking-tight">
                  {attempt.isDisqualified ? 'Đình chỉ' : 'Đã nộp bài'}
                </span>
              </div>
              <span className="text-[11px] text-white/95 font-medium px-2.5 py-0.5 bg-white/20 rounded-full mt-1">
                {attempt.isDisqualified ? 'Vi phạm quy chế' : 'Chờ BTC công bố điểm'}
              </span>
            </div>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3">
          {canShowScore ? (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs text-slate-500">
                  {attempt.tieBreakerTotalQuestions && attempt.tieBreakerTotalQuestions > 0
                    ? 'Câu chính / Câu phụ đúng'
                    : 'Số câu đúng'}
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {attempt.tieBreakerTotalQuestions && attempt.tieBreakerTotalQuestions > 0
                    ? `${attempt.mainCorrectCount ?? 0}/${attempt.mainTotalQuestions ?? 0} chính • ${attempt.tieBreakerCorrectCount ?? 0}/${attempt.tieBreakerTotalQuestions} phụ`
                    : `${attempt.correctCount} / ${exam.questions.length} câu`}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center gap-3">
              <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs text-slate-500">Tiến trình đã làm</div>
                <div className="text-sm font-bold text-slate-900">
                  {answeredCount} / {exam.questions.length} câu
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <div className="text-xs text-slate-500">Thời gian làm</div>
              <div className="text-sm font-bold text-slate-900">
                {minutesSpent}p {secondsSpent}s
              </div>
            </div>
          </div>

          {canShowScore ? (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center gap-3">
              <Award className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <div className="text-xs text-slate-500">Tỉ lệ chính xác</div>
                <div className="text-sm font-bold text-slate-900">
                  {Math.round(((attempt.correctCount || 0) / exam.questions.length) * 100)}%
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <div className="text-xs text-slate-500">Công bố kết quả</div>
                <div className="text-sm font-bold text-amber-700">
                  Chờ BTC công bố
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center gap-3">
            <ShieldAlert className={`w-5 h-5 shrink-0 ${attempt.tabSwitchCount > 0 ? 'text-red-500' : 'text-slate-400'}`} />
            <div>
              <div className="text-xs text-slate-500">Cảnh báo rời tab</div>
              <div className={`text-sm font-bold ${attempt.tabSwitchCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {attempt.tabSwitchCount} lần
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onBackToHome}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về danh sách đề thi</span>
          </button>

          {canRetake ? (
            <button
              onClick={onRetake}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Làm lại bài thi</span>
            </button>
          ) : (
            <div className="px-3.5 py-2 text-xs font-semibold text-slate-500 bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Đã hoàn thành {maxAttempts} lượt thi quy định</span>
            </div>
          )}
        </div>
      </div>

      {/* Solutions & Explanations (Chi tiết đáp án & Lời giải) */}
      {canShowScore && exam.settings?.showExplanations && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span>Chi tiết đáp án &amp; Lời giải chi tiết</span>
              </h2>
              <p className="text-xs text-slate-500">
                Đối chiếu bài làm của bạn với đáp án chuẩn và lời giải chuẩn TeX
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Tất cả ({exam.questions.length})
              </button>
              <button
                onClick={() => setFilterMode('wrong')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterMode === 'wrong' ? 'bg-white text-red-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Câu sai ({exam.questions.length - (attempt.correctCount || 0)})
              </button>
              <button
                onClick={() => setFilterMode('correct')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterMode === 'correct' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Câu đúng ({attempt.correctCount || 0})
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredQuestions.map((q) => {
              const studentChoice = attempt.answers[q.id];
              const isCorrect = studentChoice?.toUpperCase() === q.correctOptionId.toUpperCase();
              const secObj = (exam.sections || []).find((s) => s.id === q.sectionId);
              const isTieBreakerQ = Boolean(secObj?.isTieBreaker || q.points === 0);

              return (
                <div
                  key={q.id}
                  className={`bg-white rounded-2xl p-5 md:p-6 border transition-all ${
                    isCorrect ? 'border-emerald-200' : 'border-red-200'
                  }`}
                >
                  {/* Status header */}
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                        isCorrect ? 'bg-emerald-600' : 'bg-red-500'
                      }`}>
                        {q.number}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        {isCorrect ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            {isTieBreakerQ ? 'Đúng (Câu hỏi phụ - xét khi bằng điểm)' : `Đúng (+${q.points}đ)`}
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            {isTieBreakerQ ? 'Sai (Câu hỏi phụ)' : 'Sai (0đ)'}
                          </span>
                        )}
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">
                          Bạn chọn: <strong className="font-mono">{studentChoice || 'Chưa chọn'}</strong>
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-emerald-700">
                          Đáp án đúng: <strong className="font-mono">{q.correctOptionId}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Question Content */}
                  <div className="text-sm md:text-base text-slate-900 leading-relaxed">
                    <MathView content={q.content} />
                  </div>

                  {/* Image if present */}
                  {q.imageUrl && (
                    <div className="mt-3 mb-3">
                      <div
                        className="relative inline-block border border-slate-200 rounded-xl overflow-hidden cursor-pointer group bg-slate-50"
                        onClick={() => setLightboxImage({ src: q.imageUrl!, caption: q.imageCaption })}
                      >
                        <img
                          src={q.imageUrl}
                          alt={`Hình câu ${q.number}`}
                          className="max-h-56 max-w-full object-contain rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                          <ZoomIn className="w-4 h-4" />
                          <span>Xem ảnh</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Choices list */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt) => {
                      const isCandidateChoice = studentChoice === opt.id;
                      const isCorrectChoice = q.correctOptionId === opt.id;

                      let badgeClass = 'border-slate-200 bg-slate-50/50 text-slate-700';
                      if (isCorrectChoice) {
                        badgeClass = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-500';
                      } else if (isCandidateChoice && !isCorrectChoice) {
                        badgeClass = 'border-red-400 bg-red-50 text-red-900 line-through';
                      }

                      return (
                        <div key={opt.id} className={`p-3 rounded-xl border flex items-start gap-2.5 ${badgeClass}`}>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                            isCorrectChoice
                              ? 'bg-emerald-600 text-white'
                              : isCandidateChoice
                              ? 'bg-red-500 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {opt.id}
                          </span>
                          <div className="flex-1 pt-0.5">
                            <MathView content={opt.text} />
                          </div>
                          {isCorrectChoice && (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation box */}
                  {q.explanation && (
                    <div className="mt-4 p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs text-slate-800 space-y-1">
                      <div className="font-bold text-blue-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Lời giải chi tiết:</span>
                      </div>
                      <div className="pt-1 text-slate-800 leading-relaxed font-normal">
                        <MathView content={q.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* When score/solutions are hidden */}
      {!canShowScore && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6 text-slate-500" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-slate-900">
              Đáp án và lời giải chi tiết chưa được mở
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Đề thi đang được thiết lập chế độ bảo mật kết quả. Thí sinh sẽ không xem được câu đúng/sai và lời giải cho đến khi Ban tổ chức ELABS 2026 chính thức mở công bố đáp án.
            </p>
          </div>
        </div>
      )}

      {/* Lightbox for zooming diagrams */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.src}
          caption={lightboxImage.caption}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
};
