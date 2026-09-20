import { useEffect, useState } from 'react';
import { Send, Clock, CheckCircle2, Mail, RefreshCw, Download, Calendar, FilterX, BarChart3, Plus } from 'lucide-react';
import { obtenerEstadisticasGlobales, exportarEstadisticasCampanas } from '../services/api';
import type { GlobalStatsResult } from '../types/stats';
import { RUBROS_LABELS } from '../data/rubros';

export default function EstadisticasGenerales() {
  const [stats, setStats] = useState<GlobalStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(new Date());
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

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

  const handleExportCsv = async () => {
    try {
      const res = await exportarEstadisticasCampanas(startDate || undefined, endDate || undefined);
      if (!res.success || !res.data) {
        alert('Error al obtener datos para exportar');
        return;
      }
      
      const campanas = res.data;
      if (campanas.length === 0) {
        alert('No hay campañas para exportar en este periodo');
        return;
      }
      
      const header = ['ID', 'Asunto', 'Estado', 'Fecha Limite Envio', 'Creado En', 'Total Envios', 'Enviados', 'Fallidos', 'Pendientes'];
      const rows = campanas.map((c: any) => [
        c.id,
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
      link.setAttribute('download', `estadisticas_campanas_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV', error);
      alert('Ocurrió un error al exportar el CSV');
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
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-6 gap-4">
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
            onClick={handleExportCsv}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-surface border border-border text-dark px-4 py-2 rounded-lg hover:bg-background transition-colors font-medium shadow-sm w-full sm:w-auto"
          >
            <Download size={18} />
            Exportar CSV
          </button>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-surface border border-border text-dark px-4 py-2 rounded-lg hover:bg-background transition-colors font-medium shadow-sm w-full sm:w-auto"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-8 gap-3 bg-surface p-4 rounded-xl border border-border shadow-sm flex-wrap">
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

      {totalCampanas === 0 && totalColaProcessed === 0 && colaPendientes === 0 ? (
        <div className="bg-surface p-12 text-center rounded-xl border border-border shadow-sm mb-8 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
            <FilterX size={32} />
          </div>
          <h3 className="text-xl font-bold text-dark mb-2">No hay datos en este período</h3>
          <p className="text-muted max-w-md">No se encontraron campañas ni estadísticas para el rango de fechas seleccionado. Prueba ampliando las fechas o limpia los filtros para ver el panorama general.</p>
        </div>
      ) : (
        <>
          {/* KPIs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="bg-secondary/10 p-3 rounded-lg text-secondary">
            <Send size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Correos Despachados</p>
            <p className="text-2xl font-bold text-dark">{colaEnviados}</p>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="bg-warning/10 p-3 rounded-lg text-warning">
            <Clock size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Pendientes en Cola</p>
            <p className="text-2xl font-bold text-dark">{colaPendientes}</p>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-lg text-primary">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Tasa de Entrega</p>
            <p className="text-2xl font-bold text-dark">{successRate}%</p>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="bg-dark/10 p-3 rounded-lg text-dark">
            <Mail size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Total Campañas</p>
            <p className="text-2xl font-bold text-dark">{totalCampanas}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Estado de Campañas */}
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
          <h2 className="text-lg font-bold text-dark mb-6 border-b border-border pb-2">Campañas por Estado</h2>
          <div className="space-y-5">
            {stats.campanas.map((c, i) => {
              const perc = totalCampanas > 0 ? (c.count / totalCampanas) * 100 : 0;
              let barColor = 'bg-primary';
              if (c.estado === 'completada') barColor = 'bg-secondary';
              if (c.estado === 'cancelada') barColor = 'bg-danger';
              if (c.estado === 'en_proceso') barColor = 'bg-warning';
              
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium capitalize text-dark">{c.estado.replace('_', ' ')}</span>
                    <span className="text-muted font-medium">{c.count} ({perc.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2.5 overflow-hidden border border-border/50">
                    <div 
                      className={`${barColor} h-2.5 rounded-full`} 
                      style={{ width: `${perc}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribución por Rubros */}
        <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
          <h2 className="text-lg font-bold text-dark mb-6 border-b border-border pb-2">Impacto por Rubro (Top 10)</h2>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
            {stats.rubros.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No hay datos de rubros registrados en este periodo.</p>
            ) : (
              stats.rubros.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-background transition-colors border border-transparent hover:border-border">
                  <span className="text-sm font-medium text-dark flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">{i+1}</span>
                    {r.rubro === '__sin_rubro__' ? 'Sin Rubro' : RUBROS_LABELS[r.rubro] || r.rubro}
                  </span>
                  <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-md">{r.cantidad_envios} envíos</span>
                </div>
              ))
            )}
          </div>
          </div>
        </div>
      </>
      )}
    </div>
  );
}
