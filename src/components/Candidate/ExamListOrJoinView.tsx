import React from 'react';
import { Exam } from '../../types/exam';
import { Clock, Award, ArrowRight, DoorOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import { OfficialLogos } from '../OfficialLogos';

interface ExamListOrJoinViewProps {
  exams: Exam[];
  isLoading?: boolean;
  onSelectExam: (exam: Exam) => void;
}

export const ExamListOrJoinView: React.FC<ExamListOrJoinViewProps> = ({
  exams,
  isLoading = false,
  onSelectExam
}) => {
  const openExams = exams.filter((ex) => ex.status !== 'closed');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Official 4-Logo Header Showcase Banner */}
      <div className="bg-gradient-to-b from-amber-50/90 via-orange-50/40 to-white rounded-3xl border border-amber-200/80 p-6 sm:p-8 shadow-sm text-center space-y-6">
        {/* 4 Logos in Required Order: Khoa -> Đoàn -> Hội -> ELABS */}
        <div className="flex flex-col items-center gap-3">
          <div className="py-2.5 px-5 sm:px-8 bg-white/95 rounded-2xl shadow-xs border border-amber-200/60 inline-flex items-center justify-center">
            <OfficialLogos size="lg" />
          </div>

          <div className="text-center space-y-0.5 uppercase tracking-wider">
            <div className="text-xs sm:text-sm font-normal text-amber-950">
              TRƯỜNG ĐẠI HỌC KHOA HỌC TỰ NHIÊN, ĐHQG-HCM
            </div>
            <div className="text-xs sm:text-sm font-extrabold text-amber-900">
              KHOA ĐIỆN TỬ - VIỄN THÔNG
            </div>
          </div>
        </div>

        <div className="w-full mx-auto flex items-center justify-center">
          <h1 className="text-base min-[480px]:text-lg sm:text-xl md:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight uppercase leading-normal whitespace-nowrap">
            CUỘC THI HỌC THUẬT{' '}
            <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 bg-clip-text text-transparent">
              ELABS LẦN THỨ XIX
            </span>{' '}
            - NĂM 2026
          </h1>
        </div>
      </div>

      {/* Phòng thi section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-orange-100 border border-orange-200 text-orange-700">
            <DoorOpen className="w-5 h-5" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight uppercase">
            DANH SÁCH PHÒNG THI ĐANG MỞ
          </h2>
        </div>

        {/* Exams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {openExams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-lg hover:shadow-orange-500/10 transition-all p-6 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200/80 rounded-lg text-xs font-bold">
                    {exam.sections && exam.sections.length > 1
                      ? `${exam.sections.length} phần thi (${exam.sections.map((s) => s.title).join(' - ')})`
                      : 'Đề thi chính thức'}
                  </span>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-orange-50 text-orange-800 rounded-md border border-orange-200">
                    Mã: {exam.code}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-600 transition-colors leading-snug">
                  {exam.title}
                </h3>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/70">
                    <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                    <span>Thời gian: <strong className="text-slate-900">{exam.durationMinutes} phút</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/70">
                    <Award className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Số câu: <strong className="text-slate-900">{exam.questions.length} câu ({exam.totalPoints}đ)</strong></span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between text-[11px] bg-amber-50/70 px-3 py-1.5 rounded-lg border border-amber-200/80 text-amber-950 font-semibold">
                    <span>Quy định lượt thi:</span>
                    <span className="font-bold text-orange-700">
                      {((exam.settings?.maxAttempts ?? 1) > 0) ? `Tối đa ${exam.settings?.maxAttempts ?? 1} lượt / mỗi thí sinh` : 'Không giới hạn lượt thi'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => onSelectExam(exam)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Vào phòng thi</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {openExams.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-slate-600">
                    Đang tải danh sách phòng thi từ máy chủ...
                  </p>
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-600">
                  Hiện chưa có phòng thi nào đang mở.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

