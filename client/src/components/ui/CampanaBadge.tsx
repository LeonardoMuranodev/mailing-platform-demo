export const CAMPANA_ESTADO_CLASSES: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  aprobada: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  en_proceso: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700',
  pausada: 'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-700',
  completada: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
  cancelada: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700',
  archivada: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
};

export const CAMPANA_ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  aprobada: 'Aprobada',
  en_proceso: 'En Proceso',
  pausada: 'Pausada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  archivada: 'Archivada',
};

export interface CampanaBadgeProps {
  estado: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function CampanaBadge({
  estado,
  size = 'sm',
  className = '',
}: CampanaBadgeProps) {
  const normalizedEstado = estado?.toLowerCase?.() || 'borrador';
  const colorClasses = CAMPANA_ESTADO_CLASSES[normalizedEstado] || CAMPANA_ESTADO_CLASSES.borrador;
  const label = CAMPANA_ESTADO_LABELS[normalizedEstado] || estado;
  const sizeClasses = size === 'md' ? 'px-3 py-1' : 'px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center text-xs font-semibold rounded-full border shadow-2xs transition-colors ${sizeClasses} ${colorClasses} ${className}`}
    >
      {label}
    </span>
  );
}
