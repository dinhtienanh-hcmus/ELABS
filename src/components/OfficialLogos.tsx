import React from 'react';

export const OFFICIAL_LOGOS = [
  {
    id: 'fetel',
    name: 'Khoa Điện tử - Viễn thông (FETEL - HCMUS)',
    shortName: 'Khoa ĐT-VT',
    src: '/assets/aistudio/FETEL_20nam_8c3c3058.png'
  },
  {
    id: 'doan',
    name: 'Đoàn Thanh niên Cộng sản Hồ Chí Minh',
    shortName: 'Đoàn TNCS',
    src: '/assets/aistudio/Logo__o_n_Thanh_NI_n_C_ng_S_n_H__Ch__Minh_7ff1236e.png'
  },
  {
    id: 'hoi',
    name: 'Hội Sinh viên Việt Nam',
    shortName: 'Hội Sinh viên',
    src: '/assets/aistudio/Logo_H_i_Sinh_Vi_n_Vi_t_Nam_fe64c19b.png'
  },
  {
    id: 'elabs',
    name: 'Cuộc thi Học thuật ELABS XIX - 2026',
    shortName: 'ELABS 2026',
    src: '/assets/aistudio/Logo_ELABS_bade6934.png'
  }
] as const;

interface OfficialLogosProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  withDividers?: boolean;
}

export const OfficialLogos: React.FC<OfficialLogosProps> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-6 sm:h-7 object-contain drop-shadow-xs',
    md: 'h-8 sm:h-9 object-contain drop-shadow-sm',
    lg: 'h-11 sm:h-12 md:h-14 object-contain drop-shadow-md',
    hero: 'h-14 sm:h-16 md:h-20 object-contain drop-shadow-lg'
  };

  const gapClasses = {
    sm: 'gap-2.5 sm:gap-3.5',
    md: 'gap-3.5 sm:gap-5',
    lg: 'gap-4 sm:gap-6 md:gap-7',
    hero: 'gap-5 sm:gap-8'
  };

  return (
    <div className={`flex items-center justify-center ${gapClasses[size]} ${className}`}>
      {OFFICIAL_LOGOS.map((logo) => (
        <div
          key={logo.id}
          className="group/logo relative flex items-center justify-center transition-all duration-300 hover:scale-105"
          title={logo.name}
        >
          <img
            src={logo.src}
            alt={logo.name}
            className={`${sizeClasses[size]} transition-transform duration-200`}
            loading="eager"
          />
        </div>
      ))}
    </div>
  );
};
