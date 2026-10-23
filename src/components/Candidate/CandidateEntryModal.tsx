import React, { useState, useMemo } from 'react';
import { Exam, CandidateInfo, getExamCandidateFields } from '../../types/exam';
import { Clock, Award, User, Hash, School, Phone, FileText, ArrowRight, X, AlertTriangle, Lock } from 'lucide-react';

interface CandidateEntryModalProps {
  exam: Exam;
  isOpen: boolean;
  onClose: () => void;
  onStartExam: (candidateInfo: CandidateInfo) => void;
}

export const CandidateEntryModal: React.FC<CandidateEntryModalProps> = ({
  exam,
  isOpen,
  onClose,
  onStartExam
}) => {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [enteredPassword, setEnteredPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const enabledFields = useMemo(() => {
    return getExamCandidateFields(exam).filter((f) => f.enabled);
  }, [exam]);

  if (!isOpen) return null;

  const handleFieldChange = (id: string, value: string) => {
    setFieldValues((prev) => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    for (const field of enabledFields) {
      const val = (fieldValues[field.id] || '').trim();
      if (field.required && !val) {
        setErrorMsg(`Vui lòng nhập ${field.label}!`);
        return;
      }
    }

    if (exam.password && exam.password.trim() !== '') {
      if (enteredPassword.trim() !== exam.password.trim()) {
        setErrorMsg('Mật khẩu phòng thi không chính xác! Vui lòng liên hệ Giám thị BTC ELABS.');
        return;
      }
    }

    const customFields: Record<string, string> = {};
    enabledFields.forEach((f) => {
      const v = (fieldValues[f.id] || '').trim();
      if (v) {
        customFields[f.id] = v;
      }
    });

    const teamGroupField =
      enabledFields.find((f) => f.isTeamGroupField) ||
      enabledFields.find((f) => f.type === 'select');

    const primaryName =
      (fieldValues['fullName'] || '').trim() ||
      (enabledFields[0] ? (fieldValues[enabledFields[0].id] || '').trim() : 'Thí sinh');
    const codeVal = (fieldValues['candidateCode'] || '').trim().toUpperCase() || '-';
    const classVal =
      (teamGroupField ? (fieldValues[teamGroupField.id] || '').trim() : '') ||
      (fieldValues['className'] || '').trim() ||
      '-';
    const phoneVal = (fieldValues['phone'] || '').trim();

    onStartExam({
      fullName: primaryName,
      candidateCode: codeVal,
      className: classVal,
      phone: phoneVal,
      customFields
    });
  };

  const handleFillDemo = () => {
    const randomMssv = Math.floor(22139000 + Math.random() * 999);
    const nextValues: Record<string, string> = { ...fieldValues };
    enabledFields.forEach((f) => {
      const validOpts = (f.options || []).map((o) => o.trim()).filter(Boolean);
      if (f.type === 'select' && validOpts.length > 0) {
        nextValues[f.id] = validOpts[0];
      } else if (f.id === 'fullName') {
        nextValues[f.id] = 'Trần Nguyễn Minh Trí';
      } else if (f.id === 'candidateCode') {
        nextValues[f.id] = `${randomMssv}`;
      } else if (f.id === 'className') {
        nextValues[f.id] = 'Đội 01 - ELABS Alpha';
      } else if (f.id === 'phone') {
        nextValues[f.id] = '0912345678';
      } else {
        nextValues[f.id] = 'Mẫu thử nghiệm';
      }
    });
    setFieldValues(nextValues);
    if (exam.password) setEnteredPassword(exam.password);
    setErrorMsg('');
  };

  const renderFieldIcon = (fieldId: string) => {
    if (fieldId === 'fullName') return <User className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />;
    if (fieldId === 'candidateCode') return <Hash className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />;
    if (fieldId === 'className') return <School className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />;
    if (fieldId === 'phone') return <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />;
    return <FileText className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />;
  };

  const ruleNote =
    exam.settings.entryRuleNote?.trim() ||
    'Cố định toàn màn hình (Full-screen Locked). Nghiêm cấm thoát màn hình, chuyển tab hoặc tra cứu tài liệu bên ngoài. Mọi vi phạm sẽ kích hoạt khóa bài và gửi báo cáo về Ban Tổ Chức.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nhập thông tin thí sinh tham gia ELABS"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 my-8">
        {/* Header with ELABS HCMUS Branding */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-white/20 rounded-full backdrop-blur-sm flex items-center gap-1">
              <span>ELABS XIX - 2026</span>
              <span>•</span>
              <span>Mã: {exam.code}</span>
            </span>
            <button
              onClick={onClose}
              aria-label="Đóng biểu mẫu"
              className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-[11px] font-semibold text-blue-200 uppercase tracking-wider mt-2">
            Khoa Điện tử - Viễn thông | Trường Đại học Khoa học tự nhiên, ĐHQG-HCM
          </div>
          <h2 className="text-xl font-bold mt-1 leading-tight">{exam.title}</h2>

          <div className="flex flex-wrap items-center gap-4 text-xs text-blue-100 mt-2.5">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Thời gian: <strong>{exam.durationMinutes} phút</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              Số câu hỏi: <strong>{exam.questions.length} câu</strong>
            </span>
            <span className="flex items-center gap-1.5">
              Thang điểm: <strong>{exam.totalPoints}đ</strong>
            </span>
          </div>
        </div>

        {/* Strict Fullscreen Notice Box */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start gap-3 text-amber-900 text-xs">
          <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-amber-950">Quy chế thi ELABS:</strong> {ruleNote}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-slate-800">Thông tin thí sinh dự thi</h3>
            {exam.settings.allowDemoFill && (
              <button
                type="button"
                onClick={handleFillDemo}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
              >
                Điền nhanh mẫu sinh viên
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {enabledFields.map((field) => {
              const validOpts = (field.options || []).map((o) => o.trim()).filter(Boolean);
              const isDropdown = field.type === 'select' && validOpts.length > 0;
              return (
                <div
                  key={field.id}
                  className={field.isHalfWidth ? 'sm:col-span-1' : 'sm:col-span-2'}
                >
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    {renderFieldIcon(field.id)}
                    {isDropdown ? (
                      <select
                        value={fieldValues[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-indigo-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all cursor-pointer"
                        required={field.required}
                      >
                        <option value="">
                          {field.placeholder || `-- Click chọn ${field.label} --`}
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
                        value={fieldValues[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className={`w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all ${
                          field.id === 'candidateCode' ? 'font-bold uppercase' : 'font-medium'
                        }`}
                        required={field.required}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {exam.password && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mật khẩu phòng thi <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                placeholder="Nhập mật khẩu do BTC ELABS cấp"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                required
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>Vào thi (Bật Toàn màn hình)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

