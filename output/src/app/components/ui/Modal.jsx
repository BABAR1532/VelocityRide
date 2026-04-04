import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ isOpen, onClose, title, children, maxWidth = 'md' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl' };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`relative bg-white rounded-2xl shadow-2xl ${maxWidthClasses[maxWidth]} w-full mx-4 max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-200`}>
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-xl transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
