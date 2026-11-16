import type { ReactNode, ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, Info, CheckCircle2 } from 'lucide-react';
import Spinner from './Spinner';

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'primary' | 'indigo' | 'success';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: ReactNode;
  isLoading?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg';
}

const VARIANT_CONFIG: Record<
  ConfirmVariant,
  { iconBg: string; iconColor: string; defaultIcon: ComponentType<{ size?: number; className?: string }>; confirmBtn: string }
> = {
  danger: {
    iconBg: 'bg-red-100 dark:bg-red-950/40',
    iconColor: 'text-red-600 dark:text-red-400',
    defaultIcon: Trash2,
    confirmBtn: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    iconBg: 'bg-amber-100 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    defaultIcon: AlertTriangle,
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  info: {
    iconBg: 'bg-blue-100 dark:bg-blue-950/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    defaultIcon: Info,
    confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  primary: {
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    defaultIcon: Info,
    confirmBtn: 'bg-primary hover:bg-primary-dark text-white',
  },
  indigo: {
    iconBg: 'bg-indigo-100 dark:bg-indigo-950/40',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    defaultIcon: Info,
    confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  success: {
    iconBg: 'bg-green-100 dark:bg-green-950/40',
    iconColor: 'text-green-600 dark:text-green-400',
    defaultIcon: CheckCircle2,
    confirmBtn: 'bg-green-600 hover:bg-green-700 text-white',
  },
};

const MAX_WIDTH_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  icon,
  isLoading = false,
  maxWidth = 'md',
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.danger;
  const DefaultIcon = config.defaultIcon;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (!isLoading && e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className={`bg-surface rounded-xl shadow-xl w-full border border-border animate-modal-pop my-auto overflow-hidden ${MAX_WIDTH_CLASSES[maxWidth]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-center mb-4">
            <div className={`p-3 rounded-full flex items-center justify-center ${config.iconBg}`}>
              {icon ? (
                <div className={config.iconColor}>{icon}</div>
              ) : (
                <DefaultIcon size={32} className={config.iconColor} />
              )}
            </div>
          </div>

          <h3 className="text-xl font-bold text-center text-dark mb-2">{title}</h3>

          <div className="text-center text-sm text-muted mb-6 leading-relaxed">
            {typeof description === 'string' ? <p>{description}</p> : description}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-surface border border-border text-dark rounded-lg font-medium hover:bg-border transition-colors cursor-pointer disabled:opacity-50 text-center text-sm"
            >
              {cancelText}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-center text-sm ${config.confirmBtn}`}
            >
              {isLoading && <Spinner size="sm" color="white" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
