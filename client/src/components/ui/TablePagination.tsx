export interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
  className?: string;
}

export default function TablePagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100],
  className = '',
}: TablePaginationProps) {
  if (total <= 0) return null;

  return (
    <div
      className={`px-4 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between bg-background gap-4 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-center sm:text-left">
        <span className="text-sm text-muted whitespace-nowrap">
          Página <span className="font-medium text-dark">{page}</span> de{' '}
          <span className="font-medium text-dark">{totalPages}</span>
        </span>

        {onLimitChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="pagination-limit" className="text-sm text-muted whitespace-nowrap">
              Mostrar:
            </label>
            <select
              id="pagination-limit"
              value={limit}
              onChange={(e) => {
                onLimitChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="px-2 py-1 bg-background border border-border rounded text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {limitOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-2 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="flex-1 sm:flex-none px-3 py-1.5 border border-border rounded-md text-sm font-medium text-dark disabled:opacity-50 hover:bg-surface transition-colors text-center cursor-pointer disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="flex-1 sm:flex-none px-3 py-1.5 border border-border rounded-md text-sm font-medium text-dark disabled:opacity-50 hover:bg-surface transition-colors text-center cursor-pointer disabled:cursor-not-allowed"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
