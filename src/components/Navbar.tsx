import React from 'react';
import {
  LayoutDashboard,
  LogIn,
  LogOut,
  BookOpen,
  ShieldCheck,
  Award
} from 'lucide-react';
import { OfficialLogos } from './OfficialLogos';

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
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-amber-200/70 shadow-xs">
      {/* 2026 Signature Golden-Orange Top Bar Accent */}
      <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 w-full" />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand Area with 4 Official Logos: Khoa -> Đoàn -> Hội -> ELABS */}
        <div
          onClick={() => onSelectTab('candidate')}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group"
          title="Về trang chủ thi trực tuyến ELABS"
        >
          {/* 4 Official Logos */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 rounded-2xl transition-all shadow-xs shrink-0">
            <OfficialLogos size="sm" />
          </div>

          <div className="hidden min-[420px]:block">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm sm:text-base text-slate-900 tracking-tight group-hover:text-orange-600 transition-colors">
                ELABS XIX - 2026
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white uppercase tracking-wider shadow-xs">
                HCMUS
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-semibold leading-tight line-clamp-1">
              Khoa Điện tử - Viễn thông | Trường Đại học Khoa học tự nhiên, ĐHQG-HCM
            </div>
          </div>
        </div>

        {/* Center Nav Tabs: Only visible when logged in */}
        {isBtcLoggedIn && (
          <nav className="flex items-center gap-1 bg-amber-50/60 p-1 rounded-2xl border border-amber-200/80 text-xs font-semibold shrink-0 whitespace-nowrap">
            <button
              onClick={() => onSelectTab('candidate')}
              className={`px-3 sm:px-4 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                currentTab === 'candidate'
                  ? 'bg-white text-orange-700 shadow-xs border border-amber-200/70 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span className="whitespace-nowrap">Giao diện thi</span>
            </button>

            <button
              onClick={() => onSelectTab('btc')}
              className={`px-3 sm:px-4 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                currentTab === 'btc'
                  ? 'bg-white text-orange-700 shadow-xs border border-amber-200/70 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="whitespace-nowrap">Quản trị đề thi</span>
            </button>
          </nav>
        )}

        {/* Right side: Login / Logout */}
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          {isBtcLoggedIn ? (
            <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] font-bold whitespace-nowrap shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="whitespace-nowrap">Ban Tổ Chức ELABS</span>
              </div>

              <button
                onClick={onBtcLogout}
                className="px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                title="Đăng xuất khỏi hệ thống"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenBtcLogin}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-orange-700 hover:bg-orange-50/60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-amber-200 bg-white shadow-xs"
            >
              <LogIn className="w-4 h-4 text-orange-600" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

