import React, { useState, useEffect, useCallback } from 'react';
import { Exam } from '../../types/exam';
import {
  loadActiveTakers,
  subscribeToCloudActiveTakers,
  removeActiveTaker,
  clearAllActiveTakersFromCloud,
  ActiveTaker
} from '../../utils/storage';
import { Activity, ShieldAlert, Clock, User, Wifi, RefreshCw, Trash2, UserX } from 'lucide-react';

interface BtcLiveMonitorProps {
  exam: Exam;
  onClose: () => void;
}

export const BtcLiveMonitor: React.FC<BtcLiveMonitorProps> = ({ exam, onClose }) => {
  const [activeTakers, setActiveTakers] = useState<ActiveTaker[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshList = useCallback(() => {
    const all = loadActiveTakers();
    const forThisExam = all.filter((t) => t.examId === exam.id);
    setActiveTakers(forThisExam);
    setLastUpdated(new Date());
  }, [exam.id]);

  useEffect(() => {
    refreshList();
    const unsub = subscribeToCloudActiveTakers((all) => {
      const forThisExam = all.filter((t) => t.examId === exam.id);
      setActiveTakers(forThisExam);
      setLastUpdated(new Date());
    });
    const interval = setInterval(refreshList, 5000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [exam.id, refreshList]);

  const [isClearingStale, setIsClearingStale] = useState<boolean>(false);

  const handleClearStaleTakers = async () => {
    setIsClearingStale(true);
    try {
      await clearAllActiveTakersFromCloud(exam.id);
      refreshList();
    } finally {
      setTimeout(() => setIsClearingStale(false), 400);
    }
  };

  const handleRemoveOneTaker = (sessionId: string) => {
    removeActiveTaker(sessionId);
    setActiveTakers((prev) => prev.filter((t) => t.sessionId !== sessionId));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-lg font-bold text-slate-900">
              Giám sát Thí sinh Đang thi Trực tiếp (Live Monitor)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Đang theo dõi phòng thi: <strong className="text-slate-800">{exam.title}</strong> (Mã: {exam.code})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            Cập nhật: {lastUpdated.toLocaleTimeString('vi-VN')}
          </span>
          <button
            onClick={refreshList}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Làm mới danh sách"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {activeTakers.length > 0 && (
            <button
              onClick={handleClearStaleTakers}
              disabled={isClearingStale}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Xóa các phiên thí sinh đã thoát hoặc mất kết nối"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>{isClearingStale ? 'Đang dọn...' : 'Dọn dẹp phiên treo'}</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200/60 p-4 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-blue-700 font-medium">Thí sinh đang kết nối</div>
            <div className="text-2xl font-black text-blue-950">{activeTakers.length} bạn</div>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200/60 p-4 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-emerald-700 font-medium">Trạng thái kết nối</div>
            <div className="text-sm font-bold text-emerald-950">Ổn định • 0ms trễ mạng</div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-amber-700 font-medium">Cảnh báo gian lận</div>
            <div className="text-sm font-bold text-amber-950">
              {activeTakers.filter((t) => t.tabSwitchCount > 0).length} thí sinh có cảnh báo
            </div>
          </div>
        </div>
      </div>

      {/* Live Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Họ và tên thí sinh</th>
              <th className="py-3 px-3">MSSV</th>
              <th className="py-3 px-3">Lớp / Đơn vị</th>
              <th className="py-3 px-3">Tiến độ câu đã làm</th>
              <th className="py-3 px-3">Cố định Fullscreen</th>
              <th className="py-3 px-3">Vi phạm rời tab</th>
              <th className="py-3 px-3">Thời gian làm</th>
              <th className="py-3 px-4">Trạng thái</th>
              <th className="py-3 px-3 text-right">Xóa phiên</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeTakers.map((taker) => {
              const timeSpent = typeof taker.timeSpentSeconds === 'number'
                ? taker.timeSpentSeconds
                : Math.max(0, Math.floor((Date.now() - taker.startedAt) / 1000));
              const displayMinutes = Math.floor(timeSpent / 60);
              const displaySeconds = timeSpent % 60;

              const progress = Math.round((taker.answeredCount / (taker.totalQuestions || 1)) * 100);
              const hasViolations = taker.tabSwitchCount > 0;
              const isFullscreen = taker.isCurrentlyFullscreen !== false;

              return (
                <tr key={taker.sessionId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-800">
                    {taker.fullName}
                    {taker.isVirtual && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700">
                        Ảo / Bot
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono font-medium text-slate-600">
                    {taker.candidateCode}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{taker.className}</td>
                  <td className="py-3 px-3">
                    <div className="w-36">
                      <div className="flex justify-between text-[11px] font-medium mb-1">
                        <span>{taker.answeredCount}/{taker.totalQuestions} câu</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {isFullscreen ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        <span>Đang khóa Fullscreen</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700 inline-flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                        <span>⚠️ Thoát Fullscreen</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {hasViolations ? (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-700 inline-flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        <span>{taker.tabSwitchCount} lần</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">0 lần</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-mono font-medium">
                    {displayMinutes} phút {displaySeconds > 0 ? `${displaySeconds}s` : ''}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Đang thi</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveOneTaker(taker.sessionId)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa phiên thi này khỏi danh sách giám sát"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {activeTakers.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  Hiện chưa có thí sinh nào đang mở phòng thi này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
