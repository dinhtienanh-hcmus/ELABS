import React from 'react';
import { X, ZoomIn } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  caption?: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, caption, onClose }) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem chi tiết hình ảnh"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
            <ZoomIn className="w-4 h-4 text-blue-600" />
            <span>Hình vẽ minh họa</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng hình ảnh"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-auto flex items-center justify-center max-h-[75vh] bg-slate-900/5">
          <img
            src={src}
            alt={alt || 'Hình minh họa đề thi'}
            className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm"
          />
        </div>

        {caption && (
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 text-center font-medium">
            {caption}
          </div>
        )}
      </div>
    </div>
  );
};
