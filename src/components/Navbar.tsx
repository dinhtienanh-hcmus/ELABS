import React from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  LogIn,
  LogOut,
  BookOpen,
  ShieldCheck
} from 'lucide-react';
import { auth, isUserAdmin } from '../firebase';

interface NavbarProps {
  currentTab: 'candidate' | 'btc';
  isBtcLoggedIn: boolean;
  onSelectTab: (tab: 'candidate' | 'btc') => void;
  onOpenBtcLogin: () => void;
  onBtcLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  isBtcLoggedIn,
  onSelectTab,
  onOpenBtcLogin,
  onBtcLogout
}) => {
  const currentUser = auth.currentUser;
  const isCloudAdmin = isUserAdmin(currentUser);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab('candidate')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm sm:text-base md:text-lg text-slate-900 tracking-tight">
                ELABS XIX - 2026
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-700 text-white uppercase tracking-wider">
                HCMUS
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-semibold leading-none">
              Khoa Điện tử - Viễn thông | Trường Đại học Khoa học tự nhiên, ĐHQG-HCM
            </div>
          </div>
        </div>

        {/* Center Nav Tabs: Only visible when logged in */}
        {isBtcLoggedIn && (
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => onSelectTab('candidate')}
              className={`px-3 sm:px-4 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                currentTab === 'candidate'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Giao diện thi</span>
            </button>

            <button
              onClick={() => onSelectTab('btc')}
              className={`px-3 sm:px-4 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                currentTab === 'btc'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Quản trị đề thi</span>
            </button>
          </nav>
        )}

        {/* Right side: Login / Logout */}
        <div className="flex items-center gap-2">
          {isBtcLoggedIn ? (
            <div className="flex items-center gap-2">
              {currentUser?.email ? (
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-[150px]">{currentUser.email}</span>
                  {isCloudAdmin && (
                    <span className="px-1 py-0.2 rounded bg-emerald-200 text-emerald-900 text-[9px]">
                      Admin Cloud
                    </span>
                  )}
                </div>
              ) : (
                <button
                  onClick={onOpenBtcLogin}
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-bold transition-colors cursor-pointer"
                  title="Đăng nhập Google để đồng bộ và lưu đề an toàn lên Firestore"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Xác thực Google Cloud</span>
                </button>
              )}

              <button
                onClick={() => onSelectTab('btc')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
                <span>Trang quản trị</span>
              </button>
              <button
                onClick={onBtcLogout}
                className="px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Đăng xuất khỏi hệ thống"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenBtcLogin}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-blue-700 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200 bg-white"
            >
              <LogIn className="w-4 h-4 text-blue-600" />
              <span>Đăng nhập BTC</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
