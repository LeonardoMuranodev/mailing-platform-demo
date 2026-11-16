export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'emerald' | 'amber';
  className?: string;
  ariaLabel?: string;
}

const SIZE_CLASSES = {
  xs: 'w-3.5 h-3.5 border-2',
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-4',
  lg: 'w-10 h-10 border-4',
  xl: 'w-12 h-12 border-4',
};

const COLOR_CLASSES = {
  primary: 'border-primary/20 border-t-primary',
  white: 'border-white/30 border-t-white',
  emerald: 'border-emerald-600 border-t-transparent',
  amber: 'border-yellow-500/30 border-t-yellow-500',
};

export default function Spinner({
  size = 'sm',
  color = 'primary',
  className = '',
  ariaLabel = 'Cargando...',
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={`rounded-full animate-spin shrink-0 ${SIZE_CLASSES[size]} ${COLOR_CLASSES[color]} ${className}`}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}
