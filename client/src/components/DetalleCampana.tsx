import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, AlertTriangle, CheckCircle2, Clock, Mail, Search, RefreshCw, BarChart2 } from 'lucide-react';
import { obtenerCampanaDetalle, obtenerColaCampana } from '../services/api';
import type { CampanaConStats, ColaEnvioItem } from '../types/campana';
import { formatDate } from '../utils/formatDate';

const ESTADO_BADGE_CLASSES: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-600 border-slate-200',
  aprobada: 'bg-blue-50 text-blue-700 border-blue-200',
  en_proceso: 'bg-amber-50 text-amber-700 border-amber-200',
  completada: 'bg-green-50 text-green-700 border-green-200',
  cancelada: 'bg-red-50 text-red-700 border-red-200',
};

const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  aprobada: 'Aprobada',
  en_proceso: 'En Proceso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const COLA_BADGE_CLASSES: Record<string, string> = {
  pendiente: 'bg-slate-100 text-slate-600',
  procesando: 'bg-blue-50 text-blue-600',
  enviado: 'bg-green-50 text-green-600',
  fallido: 'bg-red-50 text-red-600',
};

export default function DetalleCampana() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [campana, setCampana] = useState<CampanaConStats | null>(null);
  const [cola, setCola] = useState<ColaEnvioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cola' | 'stats'>('cola');

  // Filtros para la cola
  const [emailFiltro, setEmailFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [campanaRes, colaRes] = await Promise.all([
        obtenerCampanaDetalle(id),
        obtenerColaCampana(id, { email: emailFiltro, estado: estadoFiltro })
      ]);
      
      if (campanaRes.success && campanaRes.data) {
        setCampana(campanaRes.data);
      }
      if (colaRes.success && colaRes.data) {
        setCola(colaRes.data);
      }
    } catch (error) {
      console.error('Error al obtener detalle:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleSearchCola = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  if (loading && !campana) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center text-muted">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
          Cargando detalles de la campaña...
        </div>
      </div>
    );
  }

  if (!campana) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <AlertTriangle size={48} className="text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-dark mb-2">Campaña no encontrada</h2>
        <button onClick={() => navigate('/')} className="text-primary hover:underline">
          Volver al listado
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted hover:text-dark font-medium transition-colors mb-4"
        >
          <ArrowLeft size={18} />
          Volver a Campañas
        </button>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark">{campana.asunto}</h1>
            <p className="text-sm text-muted mt-1 flex items-center gap-2">
              <CalendarIcon size={14} /> Creada el {formatDate(campana.creado_en)}
            </p>
          </div>
          <span className={`px-3 py-1.5 text-sm font-semibold border rounded-full ${ESTADO_BADGE_CLASSES[campana.estado] || 'bg-slate-100'}`}>
            {ESTADO_LABELS[campana.estado] || campana.estado}
          </span>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Contactos" value={campana.stats.total} icon={<Mail className="text-slate-400" />} />
        <StatCard title="Enviados" value={campana.stats.enviados} icon={<CheckCircle2 className="text-green-500" />} />
        <StatCard title="Pendientes" value={campana.stats.pendientes} icon={<Clock className="text-amber-500" />} />
        <StatCard title="Fallidos" value={campana.stats.fallidos} icon={<AlertTriangle className="text-red-500" />} />
      </div>

      {/* Tabs */}
      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden transition-colors">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('cola')}
            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors ${
              activeTab === 'cola' ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-dark'
            }`}
          >
            <Send size={18} />
            Cola de Envíos
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors ${
              activeTab === 'stats' ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-dark'
            }`}
          >
            <BarChart2 size={18} />
            Estadísticas
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'cola' ? (
            <div className="animate-fade-in">
              {/* Filtros Cola */}
              <form onSubmit={handleSearchCola} className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                  <input
                    type="text"
                    value={emailFiltro}
                    onChange={(e) => setEmailFiltro(e.target.value)}
                    placeholder="Buscar por email destinatario..."
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  />
                </div>
                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                  className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm sm:w-48"
                >
                  <option value="">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="procesando">Procesando</option>
                  <option value="enviado">Enviado</option>
                  <option value="fallido">Fallido</option>
                </select>
                <button type="submit" className="bg-background text-muted border border-border hover:bg-border hover:text-dark px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors">
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  Actualizar
                </button>
              </form>

              {/* Tabla Cola */}
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-left text-sm text-muted">
                  <thead className="bg-background text-dark text-xs uppercase font-semibold border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Email Destinatario</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Fecha Envío</th>
                      <th className="px-4 py-3">Cuenta SMTP</th>
                      <th className="px-4 py-3">Respuesta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cola.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted">
                          {campana.stats.total === 0 
                            ? 'La cola de envíos está vacía.'
                            : 'No se encontraron resultados para los filtros aplicados.'}
                        </td>
                      </tr>
                    ) : (
                      cola.map((item) => (
                        <tr key={item.id} className="hover:bg-background/50">
                          <td className="px-4 py-3 font-medium text-dark">{item.contacto_email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${COLA_BADGE_CLASSES[item.estado] || ''}`}>
                              {item.estado.charAt(0).toUpperCase() + item.estado.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {item.fecha_envio ? new Date(item.fecha_envio).toLocaleString('es-AR') : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">
                            {item.cuenta_smtp_email || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {item.respuesta_smtp ? (
                              <span className="text-xs text-red-500 cursor-help" title={item.respuesta_smtp}>
                                Ver error
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mb-4">
                <BarChart2 size={32} className="text-muted" />
              </div>
              <h3 className="text-xl font-bold text-dark mb-2">Estadísticas Detalladas</h3>
              <p className="text-muted text-center max-w-md">
                Próximamente podrás visualizar gráficos de dona con la tasa de éxito, timeline de envíos y análisis de rebotes.
              </p>
              <span className="mt-6 px-3 py-1 bg-primary/10 text-primary text-xs font-bold uppercase rounded-full tracking-wider">
                En Desarrollo
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponentes
function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-surface p-4 rounded-xl shadow-sm border border-border transition-colors">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-muted">{title}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold text-dark">{value.toLocaleString()}</p>
    </div>
  );
}

interface CalendarIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

function CalendarIcon({ size = 24, ...props }: CalendarIconProps) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  );
}
