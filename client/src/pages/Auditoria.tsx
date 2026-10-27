import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Loader2, ShieldAlert } from 'lucide-react';
import HistorialTable from '../components/HistorialTable';
import type { HistorialItem } from '../components/HistorialTable';

export default function Auditoria() {
  const { token } = useAuthStore();
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHistorial();
  }, []);

  const fetchHistorial = async () => {
    try {
      const response = await fetch('/api/historial', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setHistorial(data.data);
      }
    } catch (error) {
      console.error('Error al obtener historial global:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-primary" size={28} />
            Auditoría Global
          </h1>
          <p className="text-sm text-muted mt-1">
            Registro detallado de todos los cambios realizados en el sistema (Solo Desarrolladores).
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="animate-spin text-primary mb-2" size={32} />
            <p className="text-muted text-sm">Cargando registros de auditoría...</p>
          </div>
        ) : historial.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted">
            <p>No hay registros de actividad todavía.</p>
          </div>
        ) : (
          <HistorialTable historial={historial} showActor={true} />
        )}
      </div>
    </div>
  );
}
