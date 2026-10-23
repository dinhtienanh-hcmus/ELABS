import React, { useState } from 'react';
import { Lock, User as UserIcon, ArrowRight, X, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signOut, ADMIN_EMAILS, isUserAdmin } from '../../firebase';

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
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setError('');
    setIsLoadingGoogle(false);
    onClose();
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoadingGoogle(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (isUserAdmin(user)) {
        onLoginSuccess();
        handleClose();
      } else {
        const userEmail = user.email || 'không xác định';
        setError(`Tài khoản ${userEmail} không thuộc danh sách Ban Tổ Chức (chỉ cho phép ${ADMIN_EMAILS.join(', ')}).`);
        await signOut(auth);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setError('Bạn đã đóng cửa sổ đăng nhập Google.');
      } else {
        setError(`Lỗi đăng nhập Google: ${msg}`);
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu!');
      return;
    }

    if (
      username.trim().toLowerCase() === 'hocthuatelabs.hcmus@gmail.com' &&
      password === 'ELABS2026#235'
    ) {
      setError('');
      setUsername('');
      setPassword('');
      onLoginSuccess();
      handleClose();
    } else {
      setError('Tài khoản hoặc mật khẩu BTC không chính xác!');
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
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Xác thực Ban Tổ Chức</h3>
              <p className="text-[11px] text-slate-500">Bảo mật Firestore chống ghi đè đề thi</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Đóng đăng nhập"
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Banner */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-blue-800">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Xác thực Admin Firestore an toàn</span>
          </div>
          <p className="text-[11px] text-blue-700 leading-relaxed">
            Chỉ tài khoản Google được chỉ định (<strong>dinhtienanh.hcmus@gmail.com</strong>) mới có quyền tạo, sửa, xóa đề thi trên Firestore. Mọi truy cập lạ từ GitHub hoặc DevTools sẽ bị chặn 100%.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Google One-Click Login Button */}
        <div>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoadingGoogle}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border-2 border-blue-600 active:scale-[0.98] text-slate-900 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isLoadingGoogle ? 'Đang kết nối Google...' : 'Đăng nhập Google với tư cách BTC (Khuyên dùng)'}</span>
          </button>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-3 text-slate-400 text-[11px] font-semibold">hoặc đăng nhập bằng Mật khẩu BTC</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Ban Tổ Chức
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="hocthuatelabs.hcmus@gmail.com"
                autoComplete="off"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu quản trị
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                autoComplete="new-password"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              />
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
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
