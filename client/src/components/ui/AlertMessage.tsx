import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface AlertMessageProps {
  type: 'error' | 'success';
  message: string;
  onClose?: () => void;
  children?: ReactNode;
}

export default function AlertMessage({ type, message, onClose, children }: AlertMessageProps) {
  if (!message) return null;

  const isError = type === 'error';
  
  return (
    <div 
      className={`p-3 rounded-lg text-sm flex gap-2 font-medium animate-fade-in border relative ${
        isError 
          ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400' 
          : 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400'
      }`}
    >
      {isError ? (
        <AlertCircle size={18} className="shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
      )}
      <div className="flex-1">
        <div className="whitespace-pre-wrap">{message}</div>
        {children && <div className="mt-2">{children}</div>}
      </div>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100 shrink-0 ml-2">
          <X size={18} />
        </button>
      )}
    </div>
  );
}
