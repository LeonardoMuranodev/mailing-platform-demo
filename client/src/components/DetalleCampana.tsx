import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, AlertTriangle, CheckCircle2, Clock, Mail, Search, RefreshCw, BarChart2, Download, Eye, MousePointerClick, Pause, Play, Trash2, X } from 'lucide-react';
import { obtenerCampanaDetalle, obtenerColaCampana, cambiarEstadoCampana, eliminarCampana } from '../services/api';
import type { CampanaConStats, ColaEnvioItem } from '../types/campana';
import { formatDate } from '../utils/formatDate';
import { RUBROS_LABELS } from '../data/rubros';

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
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
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

  const handleTogglePausa = async () => {
    if (!campana) return;
    try {
      const nuevoEstado = campana.estado === 'pausada' ? 'en_proceso' : 'pausada';
      const res = await cambiarEstadoCampana(campana.id, nuevoEstado);
      if (res.success && res.data) {
        setCampana(prev => prev ? { ...prev, estado: res.data!.estado } : prev);
      }
    } catch (err) {
      console.error('Error al pausar/reanudar campaña:', err);
    }
  };

  const handleDelete = async () => {
    if (!campana) return;
    try {
      const res = await eliminarCampana(campana.id);
      if (res.success) {
        navigate('/');
      }
    } catch (err) {
      console.error('Error al eliminar campaña:', err);
    }
  };

  const exportarCSV = () => {
    if (!campana) return;
    
    const headers = ['Email', 'Estado', 'Fecha Envio', 'Fecha Apertura', 'Fecha Clic', 'Cuenta SMTP', 'Respuesta SMTP'];
    const rows = cola.map(item => [
      item.contacto_email,
      item.estado,
      item.fecha_envio ? new Date(item.fecha_envio).toLocaleString('es-AR') : '',
      item.fecha_apertura ? new Date(item.fecha_apertura).toLocaleString('es-AR') : '',
      item.fecha_click ? new Date(item.fecha_click).toLocaleString('es-AR') : '',
      item.cuenta_smtp_email || '',
      item.respuesta_smtp || ''
    ]);

    const rubrosStr = campana.para_todos_rubros 
      ? 'Todos los rubros' 
      : campana.rubros_seleccionados.map((r: string) => RUBROS_LABELS[r as keyof typeof RUBROS_LABELS] || r).join(' - ');

    const csvContent = [
      ['Asunto:', `"${campana.asunto}"`],
      ['Fecha Limite:', formatDate(campana.fecha_limite_envio)],
      ['Rubros:', `"${rubrosStr}"`],
      ['Total Contactos:', campana.stats.total.toString()],
      ['Enviados:', campana.stats.enviados.toString()],
      ['Abiertos:', campana.stats.abiertos.toString()],
      ['Clics:', campana.stats.clicks.toString()],
      ['Fallidos:', campana.stats.fallidos.toString()],
      ['Pendientes:', campana.stats.pendientes.toString()],
      [],
      headers,
      ...rows.map(row => row.map(cell => `"${cell}"`))
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reporte_${campana.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <p className="text-sm text-muted mt-1 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="flex items-center gap-1"><CalendarIcon size={14} /> Creada: {formatDate(campana.creado_en)}</span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1"><Clock size={14} /> Límite: {formatDate(campana.fecha_limite_envio)}</span>
            </p>
            <p className="text-sm text-muted mt-1">
              <strong>Rubros:</strong> {campana.para_todos_rubros ? 'Todos los rubros' : campana.rubros_seleccionados.map((r: string) => RUBROS_LABELS[r as keyof typeof RUBROS_LABELS] || r).join(', ')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className={`px-3 py-1.5 text-sm font-semibold border rounded-full ${ESTADO_BADGE_CLASSES[campana.estado] || 'bg-slate-100'}`}>
              {ESTADO_LABELS[campana.estado] || campana.estado}
            </span>
            {['en_proceso', 'aprobada'].includes(campana.estado) && (
              <>
                <button onClick={async () => {
                  import('../services/api').then(m => {
                    m.forzarEnvioCola();
                    fetchData(); // Refresca los stats
                  });
                }} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium" title="Ignorar cron y procesar la cola de envíos ahora mismo">
                  <Send size={16} /> Forzar Envío
                </button>
                <button onClick={handleTogglePausa} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium">
                  <Pause size={16} /> Pausar
                </button>
              </>
            )}
            {campana.estado === 'pausada' && (
              <button onClick={handleTogglePausa} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium">
                <Play size={16} /> Reanudar
              </button>
            )}
            <button onClick={exportarCSV} className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border text-dark rounded-lg hover:bg-border transition-colors text-sm font-medium">
              <Download size={16} /> Exportar CSV
            </button>
            <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium">
              <Trash2 size={16} /> Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard title="Contactos" value={campana.stats.total} icon={<Mail className="text-slate-400" />} />
        <StatCard title="Enviados" value={campana.stats.enviados} icon={<CheckCircle2 className="text-green-500" />} />
        <StatCard title="Interacciones" value={campana.stats.clicks} icon={<MousePointerClick className="text-purple-500" />} />
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
                      <th className="px-4 py-3 text-center">Interacción</th>
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
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-2">
                              <span title={item.fecha_apertura ? `Abierto: ${new Date(item.fecha_apertura).toLocaleString('es-AR')}` : 'No abierto'} className={`p-1 rounded-full ${item.fecha_apertura ? 'text-blue-600 bg-blue-100' : 'text-slate-300 bg-slate-50'}`}>
                                <Eye size={14} />
                              </span>
                              <span title={item.fecha_click ? `Clic: ${new Date(item.fecha_click).toLocaleString('es-AR')}` : 'Sin clics'} className={`p-1 rounded-full ${item.fecha_click ? 'text-purple-600 bg-purple-100' : 'text-slate-300 bg-slate-50'}`}>
                                <MousePointerClick size={14} />
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">
                            {item.cuenta_smtp_email || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {item.respuesta_smtp ? (
                              item.estado === 'fallido' ? (
                                <span className="text-xs font-medium text-red-600 cursor-help underline decoration-red-300 underline-offset-2" title={item.respuesta_smtp}>
                                  Error
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-green-600 cursor-help" title={item.respuesta_smtp}>
                                  OK
                                </span>
                              )
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
            <div className="animate-fade-in p-2 max-w-3xl mx-auto">
              <h3 className="text-xl font-bold text-dark mb-6 flex items-center gap-2">
                <BarChart2 className="text-primary" />
                Métricas de Envío
              </h3>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span className="text-dark flex items-center gap-1"><CheckCircle2 size={16} className="text-green-500" /> Tasa de Éxito (Enviados)</span>
                    <span className="text-green-600 font-bold">{campana.stats.total > 0 ? ((campana.stats.enviados / campana.stats.total) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <div className="w-full bg-surface border border-border rounded-full h-3 overflow-hidden">
                    <div className="bg-green-500 h-3 rounded-full transition-all duration-500" style={{ width: `${campana.stats.total > 0 ? (campana.stats.enviados / campana.stats.total) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span className="text-dark flex items-center gap-1"><MousePointerClick size={16} className="text-purple-500" /> Tasa de Interacción (Clics en enlaces)</span>
                    <span className="text-purple-600 font-bold">{campana.stats.enviados > 0 ? ((campana.stats.clicks / campana.stats.enviados) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <div className="w-full bg-surface border border-border rounded-full h-3 overflow-hidden">
                    <div className="bg-purple-500 h-3 rounded-full transition-all duration-500" style={{ width: `${campana.stats.enviados > 0 ? (campana.stats.clicks / campana.stats.enviados) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span className="text-dark flex items-center gap-1"><AlertTriangle size={16} className="text-red-500" /> Tasa de Fallos (Rebotes)</span>
                    <span className="text-red-600 font-bold">{campana.stats.total > 0 ? ((campana.stats.fallidos / campana.stats.total) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <div className="w-full bg-surface border border-border rounded-full h-3 overflow-hidden">
                    <div className="bg-red-500 h-3 rounded-full transition-all duration-500" style={{ width: `${campana.stats.total > 0 ? (campana.stats.fallidos / campana.stats.total) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span className="text-dark flex items-center gap-1"><Clock size={16} className="text-amber-500" /> Pendientes de Envío</span>
                    <span className="text-amber-600 font-bold">{campana.stats.total > 0 ? ((campana.stats.pendientes / campana.stats.total) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <div className="w-full bg-surface border border-border rounded-full h-3 overflow-hidden">
                    <div className="bg-amber-500 h-3 rounded-full transition-all duration-500" style={{ width: `${campana.stats.total > 0 ? (campana.stats.pendientes / campana.stats.total) * 100 : 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmación de Eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="bg-red-100 p-3 rounded-full">
                  <AlertTriangle size={32} className="text-red-600" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-center text-dark mb-2">
                ¿Eliminar campaña?
              </h3>
              <p className="text-center text-muted mb-6">
                Estás a punto de eliminar la campaña <strong>{campana.asunto}</strong>. Esta acción también eliminará todo su historial y métricas y no se puede deshacer.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-surface border border-border text-dark rounded-lg font-medium hover:bg-border transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm"
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
