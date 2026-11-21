import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  showCloseButton?: boolean;
  closeOnEsc?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
  bodyClassName?: string;
}

const MAX_WIDTH_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  showCloseButton = true,
  closeOnEsc = true,
  closeOnBackdrop = true,
  className = '',
  bodyClassName = 'p-6',
}: ModalProps) {
  const isMouseDownOnBackdrop = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onMouseDown={(e) => {
        isMouseDownOnBackdrop.current = (e.target === e.currentTarget);
      }}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget && isMouseDownOnBackdrop.current) {
          onClose();
        }
        isMouseDownOnBackdrop.current = false;
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-surface rounded-xl shadow-xl w-full border border-border animate-modal-pop my-auto relative overflow-hidden ${MAX_WIDTH_CLASSES[maxWidth]} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="text-lg font-bold text-dark">{title}</div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="text-muted hover:text-dark p-1 rounded-md transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <div className={bodyClassName}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
