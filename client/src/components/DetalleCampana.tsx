import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, AlertTriangle, CheckCircle2, Clock, Mail, Search, RefreshCw, BarChart2, Download, MousePointerClick, Pause, Play, Trash2, Edit3, ArrowUp, Zap, X } from 'lucide-react';
import { obtenerCampanaDetalle, obtenerColaCampana, cambiarEstadoCampana, eliminarCampana, actualizarProgramacionCampana } from '../services/api';
import type { CampanaConStats, ColaEnvioItem } from '../types/campana';
import { formatDate } from '../utils/formatDate';
import { RUBROS_LABELS } from '../data/rubros';
import { usePermisos } from '../hooks/usePermisos';

const ESTADO_BADGE_CLASSES: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  aprobada: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  en_proceso: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700',
  pausada: 'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-700',
  completada: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
  cancelada: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700',
};

const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  aprobada: 'Aprobada',
  en_proceso: 'En Proceso',
  pausada: 'Pausada',
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
  const [forzarConfirm, setForzarConfirm] = useState(false);

  // Modal para cambiar fecha límite / ritmo
  const [showModalFecha, setShowModalFecha] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaPrioridad, setNuevaPrioridad] = useState<'alta' | 'media' | 'baja'>('media');
  const [guardandoFecha, setGuardandoFecha] = useState(false);
  const [errorModalFecha, setErrorModalFecha] = useState<string | null>(null);
  const [exitoModalFecha, setExitoModalFecha] = useState(false);

  // Bloquear scroll del fondo cuando hay modal abierto
  useEffect(() => {
    const isAnyModalOpen = Boolean(deleteConfirm || forzarConfirm || showModalFecha);
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [deleteConfirm, forzarConfirm, showModalFecha]);

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { puedeEditar, puedeEliminar } = usePermisos();
  const [campana, setCampana] = useState<CampanaConStats | null>(null);
  const [cola, setCola] = useState<ColaEnvioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cola' | 'stats'>('cola');
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Filtros para la cola
  const [emailFiltro, setEmailFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  // Bloquear scroll del fondo cuando hay modal abierto
  useEffect(() => {
    const isAnyModalOpen = Boolean(deleteConfirm || forzarConfirm || showModalFecha);
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [deleteConfirm, forzarConfirm, showModalFecha]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const fetchData = async (overrideEmail?: string, overrideEstado?: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const emailToUse = overrideEmail !== undefined ? overrideEmail : emailFiltro;
      const estadoToUse = overrideEstado !== undefined ? overrideEstado : estadoFiltro;

      const [campanaRes, colaRes] = await Promise.all([
        obtenerCampanaDetalle(id),
        obtenerColaCampana(id, { email: emailToUse, estado: estadoToUse })
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
      let nuevoEstado = 'pausada';
      if (campana.estado === 'pausada') {
        nuevoEstado = campana.stats.pendientes === 0 ? 'completada' : 'en_proceso';
      }

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

  const handleForzarEnvio = async () => {
    if (!campana) return;
    setForzarConfirm(false);
    try {
      const { forzarEnvioCola } = await import('../services/api');
      await forzarEnvioCola();
      // Bloquear el botón por 10 minutos (600000ms)
      localStorage.setItem(`forzado_${campana.id}`, Date.now().toString());
      fetchData(); // Refresca stats
    } catch (err) {
      console.error('Error al forzar envio:', err);
    }
  };

  const handleGuardarProgramacion = async () => {
    if (!campana || !nuevaFecha) return;
    setGuardandoFecha(true);
    setErrorModalFecha(null);
    try {
      const res = await actualizarProgramacionCampana(campana.id, {
        fecha_limite_envio: nuevaFecha,
        prioridad: nuevaPrioridad,
      });
      if (res.success && res.data) {
        setCampana((prev) =>
          prev
            ? {
                ...prev,
                fecha_limite_envio: res.data!.fecha_limite_envio,
                prioridad: res.data!.prioridad,
              }
            : prev
        );
        setExitoModalFecha(true);
        setTimeout(() => {
          setExitoModalFecha(false);
          setShowModalFecha(false);
        }, 900);
      } else {
        setErrorModalFecha(res.error?.message || 'Error al actualizar la programación');
      }
    } catch (err: any) {
      setErrorModalFecha(err.message || 'Error de conexión');
    } finally {
      setGuardandoFecha(false);
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
      : (campana.rubros_seleccionados || []).map((r: string) => r === '__sin_rubro__' ? 'Sin Rubro' : RUBROS_LABELS[r as keyof typeof RUBROS_LABELS] || r).join(' - ');

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

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-border/70">
          {/* Identificación de la Campaña y Estado */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-dark tracking-tight">{campana.asunto}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border shadow-xs tracking-wider uppercase ${ESTADO_BADGE_CLASSES[campana.estado] || 'bg-slate-100'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse"></span>
                {ESTADO_LABELS[campana.estado] || campana.estado}
              </span>
            </div>

            {/* Metadatos: Fechas, Prioridad y Modificar */}
            <div className="text-xs sm:text-sm text-muted flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <CalendarIcon size={14} className="text-muted" />
                <span>Creada: <strong>{formatDate(campana.creado_en)}</strong></span>
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5 flex-wrap">
                <Clock size={14} className="text-muted" />
                <span>Límite: <strong>{formatDate(campana.fecha_limite_envio)}</strong></span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                  campana.prioridad === 'alta'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                    : campana.prioridad === 'baja'
                    ? 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                }`}>
                  {campana.prioridad}
                </span>
                {puedeEditar && ['borrador', 'aprobada', 'en_proceso', 'pausada'].includes(campana.estado) && (
                  <button
                    type="button"
                    onClick={() => {
                      setNuevaFecha(campana.fecha_limite_envio ? campana.fecha_limite_envio.split('T')[0] : '');
                      setNuevaPrioridad(campana.prioridad || 'media');
                      setErrorModalFecha(null);
                      setExitoModalFecha(false);
                      setShowModalFecha(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark transition-colors ml-1 cursor-pointer"
                    title="Modificar fecha límite y ritmo de despacho"
                  >
                    <Edit3 size={13} />
                    <span>Modificar</span>
                  </button>
                )}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-dark/90">
              <strong className="text-muted">Rubros:</strong> {campana.para_todos_rubros ? 'Todos los rubros' : (campana.rubros_seleccionados || []).map((r: string) => r === '__sin_rubro__' ? 'Sin Rubro' : RUBROS_LABELS[r as keyof typeof RUBROS_LABELS] || r).join(', ')}
            </p>
          </div>

          {/* Barra de Acciones Normalizada (Mobile: 2 columnas alineadas / Desktop: fila homogénea) */}
          <div className="w-full lg:w-auto">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end gap-2 sm:gap-2.5">
              {puedeEditar && campana.estado === 'borrador' && (
                <>
                  <button
                    onClick={() => navigate(`/campanas/editar/${campana.id}`)}
                    className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap shadow-xs cursor-pointer bg-surface border border-border text-dark hover:border-primary/40 hover:text-primary"
                  >
                    <Edit3 size={16} className="shrink-0" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await cambiarEstadoCampana(campana.id, 'aprobada');
                        if (res.success && res.data) {
                          setCampana(prev => prev ? { ...prev, estado: res.data!.estado } : prev);
                        }
                      } catch (err) {
                        console.error('Error al aprobar campaña:', err);
                      }
                    }}
                    className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap shadow-xs cursor-pointer bg-primary hover:bg-primary-dark text-white shadow-primary/20"
                  >
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>Aprobar</span>
                  </button>
                </>
              )}

              {puedeEditar && ['en_proceso', 'aprobada'].includes(campana.estado) && (
                <>
                  {(() => {
                    const stamp = localStorage.getItem(`forzado_${campana.id}`);
                    const isBlocked = stamp && (Date.now() - parseInt(stamp) < 600000); // 10 mins
                    if (!isBlocked) {
                      return (
                        <button
                          onClick={() => setForzarConfirm(true)}
                          className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap shadow-xs cursor-pointer bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-500/50"
                          title="Ignorar cron y procesar la cola de envíos ahora mismo"
                        >
                          <Send size={16} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
                          <span>Forzar Envío</span>
                        </button>
                      );
                    }
                    return null;
                  })()}

                  {campana.estado === 'en_proceso' && (
                    <button
                      onClick={handleTogglePausa}
                      className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap shadow-xs cursor-pointer bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50"
                      title="Pausar temporalmente los envíos automáticos"
                    >
                      <Pause size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>Pausar</span>
                    </button>
                  )}
                </>
              )}

              {puedeEditar && campana.estado === 'pausada' && (
                <button
                  onClick={handleTogglePausa}
                  className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap shadow-xs cursor-pointer bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                  title="Reanudar el despacho automático de correos"
                >
                  <Play size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Reanudar</span>
                </button>
              )}

              {puedeEditar && ['en_proceso', 'aprobada', 'pausada'].includes(campana.estado) && (
                <button
                  type="button"
                  onClick={() => {
                    setNuevaFecha(campana.fecha_limite_envio ? campana.fecha_limite_envio.split('T')[0] : '');
                    setNuevaPrioridad(campana.prioridad || 'media');
                    setErrorModalFecha(null);
                    setExitoModalFecha(false);
                    setShowModalFecha(true);
                  }}
                  className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap shadow-xs cursor-pointer bg-surface text-dark border border-border hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-600 dark:hover:text-amber-400"
                  title="Ajustar fecha límite o prioridad para acelerar o regular el ritmo de despacho"
                >
                  <Zap size={16} className="shrink-0 text-amber-500" />
                  <span>Cambiar Ritmo</span>
                </button>
              )}

              <button
                onClick={exportarCSV}
                className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap shadow-xs cursor-pointer bg-surface text-dark border border-border hover:bg-background hover:text-primary hover:border-primary/40"
                title="Descargar lista de destinatarios y estados en formato CSV"
              >
                <Download size={16} className="shrink-0 text-muted" />
                <span>Exportar CSV</span>
              </button>

              {puedeEliminar && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap shadow-xs cursor-pointer bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 col-span-2 sm:col-span-1"
                  title="Eliminar campaña"
                >
                  <Trash2 size={16} className="shrink-0 text-rose-500" />
                  <span>Eliminar</span>
                </button>
              )}
            </div>
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
            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors ${activeTab === 'cola' ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-dark'
              }`}
          >
            <Send size={18} />
            Cola de Envíos
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors ${activeTab === 'stats' ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-dark'
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
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 sm:flex-none bg-background text-muted border border-border hover:bg-border hover:text-dark px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Actualizar
                  </button>
                  {(emailFiltro || estadoFiltro) && (
                    <button type="button" onClick={() => { setEmailFiltro(''); setEstadoFiltro(''); fetchData('', ''); }} className="flex-1 sm:flex-none bg-background text-danger border border-border hover:bg-red-50 hover:border-red-200 px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center transition-colors">
                      Limpiar
                    </button>
                  )}
                </div>
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
                              <span title={item.fecha_click ? `Interactuó: ${new Date(item.fecha_click).toLocaleString('es-AR')}` : 'Sin interacciones'} className={`p-1 rounded-full ${item.fecha_click ? 'text-purple-600 bg-purple-100' : 'text-slate-300 bg-slate-50'}`}>
                                <MousePointerClick size={14} />
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">
                            {item.cuenta_smtp_email || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {item.estado === 'enviado' ? (
                              <span className="text-xs font-medium text-green-600 cursor-help" title={item.respuesta_smtp || 'Enviado correctamente'}>
                                OK
                              </span>
                            ) : item.estado === 'fallido' ? (
                              <span className="text-xs font-medium text-red-600 cursor-help underline decoration-red-300 underline-offset-2" title={item.respuesta_smtp || 'Error desconocido'}>
                                Error
                              </span>
                            ) : item.respuesta_smtp ? (
                              <span className="text-xs font-medium text-amber-600 cursor-help underline decoration-amber-300 underline-offset-2" title={item.respuesta_smtp}>
                                Reintentando
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

                {campana.stats.fallidos > 0 && (
                  <div className="mt-8 pt-6 border-t border-border">
                    <h4 className="text-md font-bold text-dark mb-4 flex items-center gap-2">
                      <AlertTriangle className="text-red-500" size={18} />
                      Análisis de Fallos
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(() => {
                        const fallosLista = campana.stats.desglose_fallos && campana.stats.desglose_fallos.length > 0
                          ? campana.stats.desglose_fallos
                          : (() => {
                            const fallidos = cola.filter(c => c.estado === 'fallido' || (c.estado === 'pendiente' && c.respuesta_smtp));
                            if (fallidos.length === 0) return [];

                            const categorias: Record<string, number> = {
                              'Cancelado': 0,
                              'Dominio Inexistente': 0,
                              'Credenciales/Login SMTP': 0,
                              'Cuota Excedida (Remitente)': 0,
                              'Casilla Llena (Destinatario)': 0,
                              'Rechazado por Spam': 0,
                              'Email Mal Escrito': 0,
                              'Otros': 0
                            };

                            fallidos.forEach(f => {
                              const msg = (f.respuesta_smtp || '').toLowerCase();
                              if (msg.includes('cancelad')) categorias['Cancelado']++;
                              else if (msg.includes('domain not found') || msg.includes('nxdomain') || msg.includes('no such domain') || msg.includes('el correo o dominio no existe')) categorias['Dominio Inexistente']++;
                              else if (msg.includes('mail_mal_escrito') || msg.includes('syntax error') || msg.includes('mal escrito')) categorias['Email Mal Escrito']++;
                              else if (msg.includes('login') || msg.includes('auth') || msg.includes('password') || msg.includes('webloginrequired')) categorias['Credenciales/Login SMTP']++;
                              else if ((msg.includes('daily sending limit') || msg.includes('quota exceeded')) && !msg.includes('mailbox') && !msg.includes('bandeja')) categorias['Cuota Excedida (Remitente)']++;
                              else if (msg.includes('mailbox full') || msg.includes('storage full') || msg.includes('bandeja de entrada llena') || (msg.includes('quota') && (msg.includes('mailbox') || msg.includes('bandeja')))) categorias['Casilla Llena (Destinatario)']++;
                              else if (msg.includes('spam') || msg.includes('blocked') || msg.includes('blacklisted') || msg.includes('bloqueado') || msg.includes('política del servidor')) categorias['Rechazado por Spam']++;
                              else categorias['Otros']++;
                            });

                            return Object.entries(categorias)
                              .filter(([_, count]) => count > 0)
                              .map(([categoria, cantidad]) => ({
                                categoria,
                                cantidad,
                                porcentaje: Math.round((cantidad / fallidos.length) * 100)
                              }));
                          })();

                        if (fallosLista.length === 0) {
                          return <p className="text-sm text-muted col-span-2">No se registran detalles específicos para los fallos.</p>;
                        }

                        return fallosLista.map((item) => (
                          <div key={item.categoria} className="bg-background border border-border p-3 rounded-lg flex justify-between items-center shadow-xs">
                            <span className="text-sm font-medium text-dark">{item.categoria}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted font-medium">{item.cantidad}</span>
                              <span className="text-xs px-2 py-1 bg-surface border border-border/50 rounded-md font-bold text-dark">
                                {item.porcentaje}%
                              </span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmación de Eliminación */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-modal-pop border border-border">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="bg-red-100 dark:bg-red-950/40 p-3 rounded-full">
                  <AlertTriangle size={32} className="text-red-600 dark:text-red-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-center text-dark mb-2">
                ¿Eliminar campaña?
              </h3>
              <p className="text-center text-muted mb-6">
                Estás a punto de eliminar la campaña <strong>{campana?.asunto}</strong>. Esta acción también eliminará todo su historial y métricas y no se puede deshacer.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-surface border border-border text-dark rounded-lg font-medium hover:bg-border transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmación para Forzar Envío */}
      {forzarConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-modal-pop border border-border">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="bg-indigo-100 dark:bg-indigo-950/40 p-3 rounded-full">
                  <Send size={32} className="text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-center text-dark mb-2">
                ¿Forzar Envío Ahora?
              </h3>
              <p className="text-center text-muted mb-6">
                Esto ignorará el cronjob automático del servidor y disparará el intento de enviar mails pendientes de forma inmediata. También ignorará las restricciones de horarios y días feriados. Solo se ejecutará un intento global y se bloqueará el botón por 10 minutos.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setForzarConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-surface border border-border text-dark rounded-lg font-medium hover:bg-border transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleForzarEnvio}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                >
                  Sí, Disparar Envíos
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal para Modificar Fecha Límite / Ritmo */}
      {showModalFecha && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-modal-pop border border-border">
            <div className="p-6">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <h3 className="text-lg font-bold text-dark flex items-center gap-2">
                  <Zap className="text-amber-500" size={20} />
                  Modificar Ritmo y Fecha Límite
                </h3>
                <button
                  onClick={() => {
                    if (!guardandoFecha) {
                      setShowModalFecha(false);
                      setErrorModalFecha(null);
                    }
                  }}
                  className="text-muted hover:text-dark p-1 rounded-md transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-sm text-dark">
                {/* Explicación del funcionamiento dinámico */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <p>
                    <strong>¿Cómo acelerar los envíos?</strong> Al adelantar la fecha límite a un día más cercano, el worker calcula automáticamente lotes más grandes por hora para enviar todos los correos a tiempo (respetando los límites seguros de las cuentas SMTP).
                  </p>
                </div>

                {errorModalFecha && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>{errorModalFecha}</span>
                  </div>
                )}

                {exitoModalFecha && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 size={15} className="shrink-0" />
                    <span>¡Fecha y ritmo actualizados con éxito!</span>
                  </div>
                )}

                {/* Input Fecha Límite */}
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                    Nueva Fecha Límite de Envío <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    value={nuevaFecha}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    disabled={guardandoFecha}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-dark disabled:opacity-50"
                  />
                  <p className="text-xs text-muted mt-1">
                    Fecha actual: <strong>{formatDate(campana.fecha_limite_envio)}</strong>
                  </p>
                </div>

                {/* Selector de Prioridad */}
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                    Prioridad de Despacho
                  </label>
                  <select
                    value={nuevaPrioridad}
                    onChange={(e) => setNuevaPrioridad(e.target.value as 'alta' | 'media' | 'baja')}
                    disabled={guardandoFecha}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-dark disabled:opacity-50"
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>

                {/* Botones de acción */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModalFecha(false);
                      setErrorModalFecha(null);
                    }}
                    disabled={guardandoFecha}
                    className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted hover:text-dark hover:bg-background transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleGuardarProgramacion}
                    disabled={guardandoFecha || !nuevaFecha}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {guardandoFecha ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Botón flotante para volver arriba (a las estadísticas) */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition-all duration-300 transform hover:scale-110 flex items-center justify-center gap-2 group"
          title="Volver a las estadísticas de la campaña"
          aria-label="Volver arriba"
        >
          <ArrowUp size={20} className="group-hover:-translate-y-0.5 transition-transform" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-xs font-semibold pr-0 group-hover:pr-1">
            Volver arriba
          </span>
        </button>
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
