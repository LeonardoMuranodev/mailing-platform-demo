import { useEffect, useState } from 'react';
import { obtenerReportesSoporte, marcarReporteResuelto } from '../../services/api';
import { CheckCircle2, FileText, Inbox } from 'lucide-react';
import logo3f from '../../assets/logo-3f.png';

interface Reporte {
  id: string;
  tipo: string;
  descripcion: string;
  adjunto_url: string | null;
  estado: string;
  creado_en: string;
  usuario_nombre: string;
  usuario_email: string;
}

export default function PanelSoporte() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'pendientes' | 'error'>('todos');

  const fetchReportes = async () => {
    setLoading(true);
    const res = await obtenerReportesSoporte();
    if (res.success && res.data) {
      setReportes(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReportes();
  }, []);

  const marcarResuelto = async (id: string) => {
    const res = await marcarReporteResuelto(id);
    if (res.success) {
      setReportes(reportes.map(r => r.id === id ? { ...r, estado: 'resuelto' } : r));
    }
  };

  const tipoColors: Record<string, string> = {
    mejora: 'bg-blue-100 text-blue-800 border-blue-200',
    sugerencia: 'bg-purple-100 text-purple-800 border-purple-200',
    error: 'bg-red-100 text-red-800 border-red-200'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 overflow-hidden rounded-[14px] shadow-sm shrink-0 mt-0.5">
            <img src={logo3f} alt="Logo 3F" className="w-full h-full object-cover scale-[1.15]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              Panel de Soporte
            </h1>
            <p className="text-muted mt-1">Gestión de mejoras, sugerencias y errores reportados.</p>
          </div>
        </div>
        
        <div className="flex bg-surface border border-border p-1 rounded-lg">
          <button 
            onClick={() => setFiltro('todos')} 
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filtro === 'todos' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-dark'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFiltro('pendientes')} 
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filtro === 'pendientes' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-dark'}`}
          >
            Pendientes
          </button>
          <button 
            onClick={() => setFiltro('error')} 
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filtro === 'error' ? 'bg-danger text-white shadow-sm' : 'text-muted hover:text-dark'}`}
          >
            Errores Críticos
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : reportes.length === 0 ? (
          <div className="p-12 flex flex-col items-center text-muted">
            <Inbox size={48} className="mb-4 opacity-20" />
            <p>No hay reportes de soporte en este momento.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reportes
              .filter(r => {
                if (filtro === 'pendientes') return r.estado === 'pendiente';
                if (filtro === 'error') return r.tipo === 'error';
                return true;
              })
              .map(reporte => (
              <div key={reporte.id} className={`p-6 transition-colors ${reporte.estado === 'resuelto' ? 'bg-background/50 opacity-70' : 'bg-surface hover:bg-background'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border uppercase ${tipoColors[reporte.tipo]}`}>
                        {reporte.tipo}
                      </span>
                      <span className="text-sm font-medium text-dark">{reporte.usuario_nombre}</span>
                      <span className="text-xs text-muted">
                        {new Date(reporte.creado_en).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    
                    <p className="text-dark whitespace-pre-wrap text-sm leading-relaxed">
                      {reporte.descripcion}
                    </p>

                    {reporte.adjunto_url && (
                      <a 
                        href={reporte.adjunto_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-primary hover:bg-primary/5 transition-colors"
                      >
                        <FileText size={16} />
                        Ver Archivo Adjunto
                      </a>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center">
                    {reporte.estado === 'pendiente' ? (
                      <button
                        onClick={() => marcarResuelto(reporte.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                      >
                        <CheckCircle2 size={16} />
                        Marcar Resuelto
                      </button>
                    ) : (
                      <span className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted">
                        <CheckCircle2 size={16} />
                        Resuelto
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
