import React from 'react';
import { Exam } from '../../types/exam';
import { Clock, Award, ArrowRight, DoorOpen } from 'lucide-react';

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
      {/* Official Header */}
      <div className="text-center space-y-2 border-b border-slate-200 pb-6">
        <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-800">
          Khoa Điện tử - Viễn thông | Trường Đại học Khoa học tự nhiên, ĐHQG-HCM
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight uppercase">
          CUỘC THI HỌC THUẬT ELABS LẦN THỨ XIX - NĂM 2026
        </h1>
      </div>

      {/* Phòng thi section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <DoorOpen className="w-5 h-5 text-blue-700" />
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Phòng thi
          </h2>
        </div>

        {/* Exams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {openExams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-lg transition-all p-6 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-lg text-xs font-semibold">
                    {exam.sections && exam.sections.length > 1
                      ? `${exam.sections.length} phần thi (${exam.sections.map((s) => s.title).join(' - ')})`
                      : 'Đề thi chính thức'}
                  </span>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                    Mã: {exam.code}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                  {exam.title}
                </h3>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Thời gian: <strong>{exam.durationMinutes} phút</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Award className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Số câu: <strong>{exam.questions.length} câu ({exam.totalPoints}đ)</strong></span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between text-[11px] bg-indigo-50/60 px-3 py-1.5 rounded-lg border border-indigo-100/80 text-indigo-900 font-semibold">
                    <span>Quy định lượt thi:</span>
                    <span className="font-bold text-indigo-700">
                      {((exam.settings?.maxAttempts ?? 1) > 0) ? `Tối đa ${exam.settings?.maxAttempts ?? 1} lượt / mỗi thí sinh` : 'Không giới hạn lượt thi'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => onSelectExam(exam)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Vào thi</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {openExams.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
