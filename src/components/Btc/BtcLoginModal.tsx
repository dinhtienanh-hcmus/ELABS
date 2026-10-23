import React, { useState } from 'react';
import { Lock, User as UserIcon, ArrowRight, X, AlertTriangle, ShieldCheck } from 'lucide-react';

interface BtcLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const BtcLoginModal: React.FC<BtcLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setError('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setError('Vui lòng nhập đầy đủ tài khoản email và mật khẩu Ban Tổ Chức!');
      return;
    }

    const isAllowedEmail =
      cleanUser === 'hocthuatelabs.hcmus@gmail.com' ||
      cleanUser === 'dinhtienanh.hcmus@gmail.com' ||
      cleanUser === 'admin';

    const isCorrectPass =
      cleanPass === 'ELABS2026#235' ||
      cleanPass === 'elabs2026#235' ||
      cleanPass === 'ELABS2026' ||
      cleanPass === 'elabs2026';

    if (isAllowedEmail && isCorrectPass) {
      setError('');
      try {
        localStorage.setItem('elabs_btc_logged_in', 'true');
        localStorage.setItem('elabs_btc_user_email', cleanUser);
      } catch {
        // ignore
      }
      setUsername('');
      setPassword('');
      onLoginSuccess();
      handleClose();
    } else {
      setError('Tài khoản hoặc mật khẩu Ban Tổ Chức không chính xác! Vui lòng kiểm tra lại.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Đăng nhập Ban Tổ Chức"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-700 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Đăng nhập Ban Tổ Chức</h3>
              <p className="text-[11px] text-slate-500 font-medium">Hệ thống quản lý đề thi &amp; phòng thi ELABS 2026</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Đóng đăng nhập"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5" autoComplete="off">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Quản trị viên
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập email BTC đã được cấp quyền..."
                autoComplete="off"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu Ban Tổ Chức
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu quản trị..."
                autoComplete="new-password"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Vào trang Quản trị</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
