import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Clock, CheckCircle2, Mail, RefreshCw, Download, Calendar, FilterX, BarChart3, Plus, AlertTriangle, X, HelpCircle, Info, Eye, MousePointerClick, Printer } from 'lucide-react';
import { obtenerEstadisticasGlobales, exportarEstadisticasCampanas } from '../services/api';
import type { GlobalStatsResult } from '../types/stats';
import { RUBROS_LABELS } from '../data/rubros';


export default function EstadisticasGenerales() {
  const [stats, setStats] = useState<GlobalStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(new Date());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);

  // Bloquear scroll del fondo cuando hay modal abierto
  useEffect(() => {
    if (Boolean(errorExport || showHelp)) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [errorExport, showHelp]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await obtenerEstadisticasGlobales(startDate || undefined, endDate || undefined);
      if (res.success && res.data) {
        setStats(res.data);
        setLastSync(new Date());
      }
    } catch (e) {
      console.error('Error fetching global stats', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = () => {
    const originalTitle = document.title;
    let fileName = 'Informe_Estadisticas_GenMailer';
    if (startDate && endDate) {
      fileName += `_${startDate}_a_${endDate}`;
    } else if (startDate) {
      fileName += `_desde_${startDate}`;
    } else if (endDate) {
      fileName += `_hasta_${endDate}`;
    } else {
      fileName += `_${new Date().toISOString().split('T')[0]}`;
    }

    document.title = fileName;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleExportCsv = async () => {
    setErrorExport(null);
    try {
      const res = await exportarEstadisticasCampanas(startDate || undefined, endDate || undefined);
      if (!res.success || !res.data) {
        setErrorExport('Error al obtener datos para exportar');
        return;
      }
      
      const campanas = res.data;
      if (campanas.length === 0) {
        setErrorExport('No hay campañas para exportar en este periodo');
        return;
      }
      
      const header = ['Asunto', 'Estado', 'Fecha Limite Envio', 'Creado En', 'Total Envios', 'Enviados', 'Fallidos', 'Pendientes'];
      const rows = campanas.map((c: any) => [
        c.asunto,
        c.estado,
        c.fecha_limite_envio ? new Date(c.fecha_limite_envio).toLocaleDateString() : '',
        new Date(c.creado_en).toLocaleDateString(),
        c.total_envios || 0,
        c.enviados || 0,
        c.fallidos || 0,
        c.pendientes || 0
      ]);
      
      const csvContent = [
        header.join(','),
        ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      let fileName = 'estadisticas_campanas';
      if (startDate && endDate) {
        fileName += `_del_${startDate}_al_${endDate}`;
      } else if (startDate) {
        fileName += `_desde_${startDate}`;
      } else if (endDate) {
        fileName += `_hasta_${endDate}`;
      } else {
        fileName += `_historico_${new Date().toISOString().split('T')[0]}`;
      }
      fileName += '.csv';
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV', error);
      setErrorExport('Ocurrió un error al exportar el CSV');
    }
  };

  const handleMesActual = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  };

  const handleAnoActual = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), 0, 1);
    const lastDay = new Date(today.getFullYear(), 11, 31);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  };

  const handleLimpiarFiltros = () => {
    setStartDate('');
    setEndDate('');
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  if (loading && !stats) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 flex justify-center text-muted">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3"></div>
          Cargando estadísticas globales...
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Calculos KPIs
  const colaEnviados = stats.cola.find(c => c.estado === 'enviado')?.count || 0;
  const colaFallidos = stats.cola.find(c => c.estado === 'fallido')?.count || 0;
  const colaPendientes = (stats.cola.find(c => c.estado === 'pendiente')?.count || 0) + 
                         (stats.cola.find(c => c.estado === 'procesando')?.count || 0);
  
  const totalColaProcessed = colaEnviados + colaFallidos;
  const successRate = totalColaProcessed > 0 ? ((colaEnviados / totalColaProcessed) * 100).toFixed(1) : '0.0';

  const totalCampanas = stats.campanas.reduce((acc, curr) => acc + curr.count, 0);

  // Mostrar pantalla completa de "No hay estadísticas en toda la BD" SOLO si no hay filtros aplicados
  if (!startDate && !endDate && totalCampanas === 0 && totalColaProcessed === 0 && colaPendientes === 0) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 animate-fade-in">
        <div className="bg-surface border border-border rounded-xl shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6">
            <BarChart3 size={48} />
          </div>
          <h2 className="text-2xl font-bold text-dark mb-3">Aún no hay estadísticas</h2>
          <p className="text-muted max-w-md mx-auto mb-8 text-lg">
            Aquí podrás visualizar métricas clave sobre el rendimiento de tus correos masivos. Comienza creando tu primera campaña para ver los datos en acción.
          </p>
          <a
            href="/nueva"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm"
          >
            <Plus size={20} />
            Crear Primera Campaña
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 animate-fade-in relative printable-report">
      {/* Modal de Error (Exportación) */}
      {errorExport && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl border border-border p-6 relative animate-modal-pop">
            <button 
              onClick={() => setErrorExport(null)}
              className="absolute top-4 right-4 text-muted hover:text-dark transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-danger/10 text-danger rounded-full flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-dark">Error al Exportar</h3>
              <p className="text-muted text-sm leading-relaxed">{errorExport}</p>
              <button
                onClick={() => setErrorExport(null)}
                className="mt-2 w-full py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── CONTENEDOR DEL REPORTE EJECUTIVO (1 SOLA HOJA) ── */}
      <div className="print-report-container">
        {/* ── ENCABEZADO EXCLUSIVO PARA IMPRESIÓN / PDF ── */}
        <div className="hidden print:block mb-4 pb-2.5 border-b-2 border-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20"><BarChart3 size={24} /></div>
              <div>
                <h1 className="text-base font-bold text-primary tracking-tight">GENMAILER ENTERPRISE</h1>
                <p className="text-[11px] font-semibold text-dark">Reporte Ejecutivo de Envíos</p>
                <p className="text-[10px] text-muted">Informe Oficial de Métricas y Rendimiento de Campañas</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase tracking-wider mb-1">
                Reporte Oficial
              </span>
              <p className="text-[10px] text-muted">
                <strong>Emisión:</strong> {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
              </p>
              <p className="text-[10px] text-muted">
                <strong>Período:</strong> {startDate && endDate ? `${startDate} al ${endDate}` : startDate ? `Desde ${startDate}` : endDate ? `Hasta ${endDate}` : 'Histórico Completo'}
              </p>
            </div>
          </div>
        </div>

        {/* Header en Pantalla */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-6 gap-4 no-print">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              Métricas y Rendimiento
            </h1>
            <p className="text-muted mt-1 text-sm">
              Última sincronización: {lastSync.toLocaleTimeString()}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <button
              onClick={handleExportPdf}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-primary text-white border border-primary px-4 py-2 h-[42px] rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm w-full sm:w-auto cursor-pointer"
              title="Descargar o imprimir reporte en PDF con gráficos"
            >
              <Printer size={18} />
              Exportar PDF
            </button>
            <button
              onClick={handleExportCsv}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-surface border border-border text-dark px-4 py-2 h-[42px] rounded-lg hover:bg-background transition-colors font-medium shadow-sm w-full sm:w-auto cursor-pointer"
            >
              <Download size={18} />
              Exportar CSV
            </button>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-surface border border-border text-dark px-4 py-2 h-[42px] rounded-lg hover:bg-background transition-colors font-medium shadow-sm w-full sm:w-auto cursor-pointer"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="flex items-center justify-center gap-2 bg-surface text-dark border border-border px-3 py-2 h-[42px] rounded-lg hover:bg-background transition-colors font-medium shadow-sm w-full sm:w-auto cursor-pointer"
              title="Ayuda sobre Métricas"
            >
              <HelpCircle size={20} className="text-primary" />
            </button>
          </div>
        </div>

        {/* Modal de Ayuda */}
        {showHelp && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg p-6 border border-border relative animate-modal-pop max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setShowHelp(false)}
                className="absolute top-4 right-4 text-muted hover:text-dark transition-colors"
              >
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
                <Info size={20} className="text-primary" />
                Acerca de Métricas y Rendimiento
              </h3>
              
              <div className="space-y-4 text-sm text-dark">
                <p>
                  En esta sección puedes consultar y exportar el resumen global de todas las campañas enviadas.
                </p>
                <div className="bg-background p-3 rounded-lg border border-border">
                  <h4 className="font-semibold text-primary mb-1">Filtros de Fecha</h4>
                  <p className="text-muted leading-relaxed">
                    Los controles de fecha (Desde / Hasta) filtran las métricas para incluir <strong>únicamente</strong> los resultados de campañas creadas o enviadas en ese rango.
                  </p>
                </div>
                <div className="bg-background p-3 rounded-lg border border-border">
                  <h4 className="font-semibold text-primary mb-1">📄 Exportar PDF con Gráficos</h4>
                  <p className="text-muted leading-relaxed">
                    Genera un informe visual formal con membrete institucional, gráficos de estado, salud del padrón y ranking de efectividad, listo para guardar como PDF o imprimir.
                  </p>
                </div>
                <div className="bg-background p-3 rounded-lg border border-border">
                  <h4 className="font-semibold text-primary mb-1">📊 Exportar CSV</h4>
                  <p className="text-muted leading-relaxed">
                    Al hacer clic en <strong>Exportar CSV</strong>, el archivo generado contendrá exactamente los datos tabulares calculados según las fechas seleccionadas.
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setShowHelp(false)}
                className="mt-6 w-full px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-8 gap-3 bg-surface p-4 rounded-xl border border-border shadow-sm flex-wrap no-print">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const today = new Date();
                const past = new Date(today);
                past.setDate(today.getDate() - 7);
                setStartDate(past.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
              }}
              className="px-3 py-1.5 text-sm bg-primary/10 text-primary font-medium rounded-lg hover:bg-primary/20 transition-colors"
            >
              Últimos 7 días
            </button>
            <button
              onClick={handleMesActual}
              className="px-3 py-1.5 text-sm bg-primary/10 text-primary font-medium rounded-lg hover:bg-primary/20 transition-colors"
            >
              Mes Actual
            </button>
            <button
              onClick={handleAnoActual}
              className="px-3 py-1.5 text-sm bg-primary/10 text-primary font-medium rounded-lg hover:bg-primary/20 transition-colors"
            >
              Año Actual
            </button>
          </div>
          
          <div className="hidden lg:block w-px h-6 bg-border mx-2"></div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm bg-background border border-border text-dark rounded-lg outline-none focus:border-primary transition-colors w-[150px]"
                title="Fecha desde"
              />
              <Calendar size={14} className="absolute left-2.5 top-2.5 text-muted" />
            </div>
            <span className="text-muted text-sm">-</span>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm bg-background border border-border text-dark rounded-lg outline-none focus:border-primary transition-colors w-[150px]"
                title="Fecha hasta"
              />
              <Calendar size={14} className="absolute left-2.5 top-2.5 text-muted" />
            </div>
            
            {(startDate || endDate) && (
              <button
                onClick={handleLimpiarFiltros}
                className="p-1.5 text-danger bg-danger/10 rounded-lg hover:bg-danger/20 transition-colors ml-1"
                title="Limpiar filtros"
              >
                <FilterX size={18} />
              </button>
            )}
          </div>
        </div>

        {/* KPIs Grid - 3 arriba y 3 abajo en impresión */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8 print:grid-cols-3 print:gap-3 print:mb-4">
          {/* Campañas */}
          <div className="bg-surface p-4 sm:p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between min-h-[96px] print:p-2.5 print:min-h-0 print:gap-1.5 transition-colors">
            <div className="flex items-center justify-between w-full mb-2 print:mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider print:text-[11px] print:font-bold print:tracking-tight truncate mr-2">Campañas</span>
              <div className="bg-dark/10 p-2 sm:p-2.5 rounded-lg text-dark print:p-1.5 print:rounded-md shrink-0">
                <Mail size={22} className="print:w-4 print:h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-dark print:text-lg print:leading-none">{totalCampanas}</p>
          </div>

          {/* Despachados */}
          <div className="bg-surface p-4 sm:p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between min-h-[96px] print:p-2.5 print:min-h-0 print:gap-1.5 transition-colors">
            <div className="flex items-center justify-between w-full mb-2 print:mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider print:text-[11px] print:font-bold print:tracking-tight truncate mr-2">Despachados</span>
              <div className="bg-secondary/10 p-2 sm:p-2.5 rounded-lg text-secondary print:p-1.5 print:rounded-md shrink-0">
                <Send size={22} className="print:w-4 print:h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-dark print:text-lg print:leading-none">{colaEnviados}</p>
          </div>

          {/* Pendientes */}
          <div className="bg-surface p-4 sm:p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between min-h-[96px] print:p-2.5 print:min-h-0 print:gap-1.5 transition-colors">
            <div className="flex items-center justify-between w-full mb-2 print:mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider print:text-[11px] print:font-bold print:tracking-tight truncate mr-2">Pendientes</span>
              <div className="bg-warning/10 p-2 sm:p-2.5 rounded-lg text-warning print:p-1.5 print:rounded-md shrink-0">
                <Clock size={22} className="print:w-4 print:h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-dark print:text-lg print:leading-none">{colaPendientes}</p>
          </div>

          {/* Tasa Entrega */}
          <div className="bg-surface p-4 sm:p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between min-h-[96px] print:p-2.5 print:min-h-0 print:gap-1.5 transition-colors">
            <div className="flex items-center justify-between w-full mb-2 print:mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider print:text-[11px] print:font-bold print:tracking-tight truncate mr-2" title="Tasa de Entrega">Tasa de Entrega</span>
              <div className="bg-primary/10 p-2 sm:p-2.5 rounded-lg text-primary print:p-1.5 print:rounded-md shrink-0">
                <CheckCircle2 size={22} className="print:w-4 print:h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-dark print:text-lg print:leading-none">{successRate}%</p>
          </div>

          {/* Aperturas */}
          <div className="bg-surface p-4 sm:p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between min-h-[96px] print:p-2.5 print:min-h-0 print:gap-1.5 transition-colors">
            <div className="flex items-center justify-between w-full mb-2 print:mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider print:text-[11px] print:font-bold print:tracking-tight truncate mr-2">Aperturas</span>
              <div className="bg-info/10 p-2 sm:p-2.5 rounded-lg text-[#0ea5e9] print:p-1.5 print:rounded-md shrink-0">
                <Eye size={22} className="print:w-4 print:h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-dark print:text-lg print:leading-none">{stats.aperturasTotales}</p>
          </div>

          {/* Clics */}
          <div className="bg-surface p-4 sm:p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between min-h-[96px] print:p-2.5 print:min-h-0 print:gap-1.5 transition-colors">
            <div className="flex items-center justify-between w-full mb-2 print:mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider print:text-[11px] print:font-bold print:tracking-tight truncate mr-2">Clics</span>
              <div className="bg-success/10 p-2 sm:p-2.5 rounded-lg text-[#10b981] print:p-1.5 print:rounded-md shrink-0">
                <MousePointerClick size={22} className="print:w-4 print:h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-dark print:text-lg print:leading-none">{stats.clicsTotales}</p>
          </div>
        </div>

        {/* Grid de 2 columnas: Campañas por Estado y Salud del Padrón */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 print:grid-cols-2 print:gap-3.5 print:mb-4">
          {/* Estado de Campañas */}
          <div className="bg-surface p-6 rounded-xl border border-border shadow-sm print:p-3">
            <h2 className="text-lg font-bold text-dark mb-6 border-b border-border pb-2 print:text-xs print:font-bold print:uppercase print:tracking-wider print:mb-2 print:pb-1">Campañas por Estado</h2>
            <div className="space-y-5 print:space-y-1.5">
              {stats.campanas.map((c, i) => {
                const perc = totalCampanas > 0 ? (c.count / totalCampanas) * 100 : 0;
                let barColor = 'bg-[#3b82f6]';
                if (c.estado === 'completada') barColor = 'bg-[#10b981]';
                else if (c.estado === 'cancelada') barColor = 'bg-[#ef4444]';
                else if (c.estado === 'en_proceso') barColor = 'bg-[#f59e0b]';
                else if (c.estado === 'pausada') barColor = 'bg-[#854d0e]';
                else if (c.estado === 'borrador') barColor = 'bg-[#64748b]';
                else if (c.estado === 'aprobada') barColor = 'bg-[#3b82f6]';
                
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5 print:text-[10.5px] print:mb-0.5">
                      <span className="font-medium capitalize text-dark">{c.estado.replace('_', ' ')}</span>
                      <span className="text-muted font-medium">{c.count} ({perc.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2.5 overflow-hidden border border-border/50 print:h-1.5">
                      <div 
                        className={`${barColor} h-2.5 rounded-full print:h-1.5`} 
                        style={{ width: `${perc}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Salud del Padrón y Distribución de Rebotes */}
          <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col print:p-3">
            <h2 className="text-lg font-bold text-dark mb-6 border-b border-border pb-2 print:text-xs print:font-bold print:uppercase print:tracking-wider print:mb-2 print:pb-1">Salud del Padrón y Contactos</h2>
            {stats.padron.length === 0 ? (
              <p className="text-muted text-sm text-center py-4 print:text-xs">No hay datos de contactos en la base de datos.</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8 flex-1 print:gap-3">
                {(() => {
                  const total = stats.padron.reduce((acc, curr) => acc + curr.count, 0);
                  const sortedPadron = [...stats.padron].sort((a, b) => b.count - a.count || a.estado.localeCompare(b.estado));
                  const colors: Record<string, string> = {
                    'funcional': '#10b981',             // Verde (Activos)
                    'rebotado inexistente': '#ef4444',  // Rojo
                    'rebotado bandeja llena': '#f97316',// Naranja
                    'rebotado spam': '#854d0e',         // Marrón
                    'inactivo': '#64748b',              // Gris
                    'rebotado desconocido': '#8b5cf6',   // Violeta
                    'mal_escrito': '#db2777'            // Rosa
                  };
                  
                  let currentDeg = 0;
                  const conicStops = sortedPadron.map(p => {
                    const percentage = total > 0 ? (p.count / total) * 360 : 0;
                    const color = colors[p.estado] || '#cbd5e1';
                    const start = currentDeg;
                    currentDeg += percentage;
                    return `${color} ${start}deg ${currentDeg}deg`;
                  }).join(', ');

                  return (
                    <>
                      <div className="relative w-48 h-48 rounded-full flex items-center justify-center shadow-inner shrink-0 print:w-24 print:h-24" style={{ background: `conic-gradient(${conicStops})` }}>
                        <div className="w-32 h-32 bg-surface rounded-full flex flex-col items-center justify-center shadow-sm print:w-16 print:h-16">
                          <span className="text-2xl font-bold text-dark print:text-sm print:leading-none">{total}</span>
                          <span className="text-xs text-muted font-medium print:text-[8.5px]">Contactos</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 print:gap-0.5 flex-1 w-full">
                        {sortedPadron.map((p, i) => {
                          const perc = total > 0 ? ((p.count / total) * 100).toFixed(1) : '0';
                          return (
                            <div key={i} className="flex items-center gap-2 text-sm print:text-[10px]">
                              <span className="w-3 h-3 rounded-full shrink-0 print:w-1.5 print:h-1.5" style={{ backgroundColor: colors[p.estado] || '#cbd5e1' }}></span>
                              <span className="font-medium text-dark capitalize truncate">
                                {p.estado === 'funcional' ? 'Contactos Activos' : 
                                 p.estado === 'rebotado spam' ? 'Marcados Spam' : 
                                 p.estado === 'rebotado inexistente' ? 'Mails Inexistentes' : 
                                 p.estado === 'rebotado desconocido' ? 'Rebotado Desc.' : 
                                 p.estado === 'rebotado bandeja llena' ? 'Bandeja Llena' : 
                                 p.estado === 'mal_escrito' ? 'Mal Escrito' : 
                                 p.estado}
                              </span>
                              <span className="text-muted ml-auto pl-2 shrink-0">{perc}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Distribución por Rubros (Top 10) */}
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm mb-8 print:p-3.5 print:mb-4 print-avoid-break">
          <h2 className="text-lg font-bold text-dark mb-6 border-b border-border pb-2 print:text-xs print:font-bold print:uppercase print:tracking-wider print:mb-2 print:pb-1">Impacto por Rubro (Top 10)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 max-h-[360px] overflow-y-auto pr-2 print:max-h-none print:overflow-visible print:pr-0 print:grid-cols-2 print:gap-x-6 print:gap-y-1">
            {stats.rubros.length === 0 ? (
              <p className="text-muted text-sm text-center py-4 col-span-full print:text-xs print:py-2">No hay datos de rubros registrados en este periodo.</p>
            ) : (
              stats.rubros.map((r, i) => {
                const totalRubros = stats.rubros.reduce((acc, curr) => acc + curr.cantidad_envios, 0);
                const perc = totalRubros > 0 ? (r.cantidad_envios / totalRubros) * 100 : 0;
                const RANKING_COLORS = [
                  { bar: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb' },
                  { bar: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', text: '#059669' },
                  { bar: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed' },
                  { bar: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706' },
                  { bar: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777' },
                  { bar: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', text: '#0891b2' },
                  { bar: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c' },
                  { bar: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', text: '#4f46e5' },
                  { bar: '#14b8a6', bg: 'rgba(20, 184, 166, 0.12)', text: '#0d9488' },
                  { bar: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', text: '#9333ea' }
                ];
                const rankColor = RANKING_COLORS[i % RANKING_COLORS.length];
                return (
                  <div key={i} className="flex flex-col gap-1 p-2.5 rounded-lg hover:bg-background transition-colors border border-transparent hover:border-border print:p-1 print:gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-dark flex items-center gap-2 print:text-[10px]">
                        <span 
                          className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold print:w-3.5 print:h-3.5 print:text-[8.5px]"
                          style={{ backgroundColor: rankColor.bg, color: rankColor.text }}
                        >
                          {i+1}
                        </span>
                        <span className="truncate max-w-[180px] print:max-w-[210px]">
                          {r.rubro === '__sin_rubro__' ? 'Sin Rubro' : RUBROS_LABELS[r.rubro] || r.rubro}
                        </span>
                      </span>
                      <span className="text-sm font-bold print:text-[10px]" style={{ color: rankColor.text }}>
                        {r.cantidad_envios} envíos
                      </span>
                    </div>
                    <div className="w-full bg-background rounded-full h-1.5 overflow-hidden print:h-1">
                      <div 
                        className="h-1.5 rounded-full print:h-1" 
                        style={{ width: `${perc}%`, backgroundColor: rankColor.bar }}
                      ></div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Ranking de Campañas */}
        <div className="bg-surface p-4 sm:p-6 rounded-xl border border-border shadow-sm mb-6 print:p-3.5 print:mb-3 overflow-hidden print-avoid-break">
          <h2 className="text-lg font-bold text-dark mb-4 sm:mb-6 border-b border-border pb-2 print:text-xs print:font-bold print:uppercase print:tracking-wider print:mb-2 print:pb-1">Ranking de Campañas</h2>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-primary text-white">
                  <th className="py-2.5 px-3 rounded-tl-lg font-semibold print:py-1 print:px-2 print:text-[10px]">Asunto del evento</th>
                  <th className="py-2.5 px-2 font-semibold text-center whitespace-nowrap print:py-1 print:text-[10px]">Efectividad</th>
                  <th className="py-2.5 px-2 font-semibold text-center whitespace-nowrap print:py-1 print:text-[10px]">Aperturas</th>
                  <th className="py-2.5 px-2 font-semibold text-center whitespace-nowrap print:py-1 print:text-[10px]">Total enviados</th>
                  <th className="py-2.5 px-3 rounded-tr-lg font-semibold text-center whitespace-nowrap print:py-1 print:px-2 print:text-[10px]">Total errores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.ranking.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted text-sm print:p-2 print:text-xs">No hay campañas registradas en este periodo</td></tr>
                ) : (
                  stats.ranking.map((r, i) => {
                    const efectividad = r.procesados > 0 ? ((r.exitosos / r.procesados) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={i} className="hover:bg-background transition-colors">
                        <td className="py-2 px-3 text-dark font-medium max-w-[220px] sm:max-w-[280px] truncate print:py-1 print:px-2 print:max-w-[260px] print:text-[10px]" title={r.asunto}>
                          {i+1}. {r.asunto}
                        </td>
                        <td className="py-2 px-2 text-dark font-medium text-center print:py-1 print:text-[10px]">{efectividad}%</td>
                        <td className="py-2 px-2 text-dark text-center print:py-1 print:text-[10px]">{r.aperturas} <span className="text-muted text-xs print:text-[9px]">({r.procesados > 0 ? ((r.aperturas/r.procesados)*100).toFixed(1) : '0'}%)</span></td>
                        <td className="py-2 px-2 text-dark text-center print:py-1 print:text-[10px]">{r.procesados}</td>
                        <td className="py-2 px-3 text-danger font-medium text-center print:py-1 print:px-2 print:text-[10px]">{r.fallidos}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── PIE DE PÁGINA EXCLUSIVO PARA IMPRESIÓN / PDF ── */}
        <div className="hidden print:flex items-center justify-between pt-3 mt-4 border-t border-border text-[10px] text-muted">
          <span>Documento generado por GenMailer • Plataforma de Mailing Masivo</span>
          <span>Reporte de Rendimiento y Campañas</span>
        </div>
      </div>
    </div>
  );
}
