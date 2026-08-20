import { useEffect, useState } from 'react';
import { Send, Clock, CheckCircle2, Mail, RefreshCw, Download } from 'lucide-react';
import { obtenerEstadisticasGlobales, exportarEstadisticasCampanas } from '../services/api';
import type { GlobalStatsResult } from '../types/stats';
import { RUBROS_LABELS } from '../data/rubros';

export default function EstadisticasGenerales() {
  const [stats, setStats] = useState<GlobalStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(new Date());

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await obtenerEstadisticasGlobales();
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
      const res = await exportarEstadisticasCampanas();
      if (!res.success || !res.data) {
        alert('Error al obtener datos para exportar');
        return;
      }
      
      const campanas = res.data;
      if (campanas.length === 0) {
        alert('No hay campañas para exportar');
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
      link.setAttribute('download', 'estadisticas_campanas.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV', error);
      alert('Ocurrió un error al exportar el CSV');
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

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

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            Métricas y Rendimiento Global
          </h1>
          <p className="text-muted mt-1 text-sm">
            Última sincronización: {lastSync.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportCsv}
            disabled={loading}
            className="flex items-center gap-2 bg-surface border border-border text-dark px-4 py-2 rounded-lg hover:bg-background transition-colors font-medium shadow-sm"
          >
            <Download size={18} />
            Exportar CSV
          </button>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 bg-surface border border-border text-dark px-4 py-2 rounded-lg hover:bg-background transition-colors font-medium shadow-sm"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Actualizar datos
          </button>
        </div>
      </div>

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
              <p className="text-muted text-sm text-center py-4">No hay datos de rubros registrados.</p>
            ) : (
              stats.rubros.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-background transition-colors border border-transparent hover:border-border">
                  <span className="text-sm font-medium text-dark flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">{i+1}</span>
                    {RUBROS_LABELS[r.rubro] || r.rubro}
                  </span>
                  <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-md">{r.cantidad_envios} envíos</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
