import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, RotateCcw } from 'lucide-react';
import { listarCampanas } from '../services/api';
import type { CampanaResponse } from '../types/campana';
import { usePermisos } from '../hooks/usePermisos';
import { formatDate } from '../utils/formatDate';
import { RUBROS_LABELS, RUBROS_LIST } from '../data/rubros';
import logo3f from '../assets/logo-3f.png';

const ESTADO_BADGE_CLASSES: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-600 border border-slate-200',
  aprobada: 'bg-blue-50 text-blue-700 border border-blue-200',
  en_proceso: 'bg-amber-50 text-amber-700 border border-amber-200',
  completada: 'bg-green-50 text-green-700 border border-green-200',
  cancelada: 'bg-red-50 text-red-700 border border-red-200',
};

const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  aprobada: 'Aprobada',
  en_proceso: 'En Proceso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function ListaCampanas() {
  const navigate = useNavigate();
  const { puedeCrear } = usePermisos();
  const [campanas, setCampanas] = useState<CampanaResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [asunto, setAsunto] = useState('');
  const [estado, setEstado] = useState('');
  const [rubro, setRubro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const fetchCampanas = async () => {
    setLoading(true);
    try {
      const res = await listarCampanas({ asunto, estado, rubro, fecha_desde: fechaDesde, fecha_hasta: fechaHasta });
      if (res.success && res.data) {
        setCampanas(res.data);
      }
    } catch (error) {
      console.error('Error al listar campañas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampanas();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCampanas();
  };

  const handleResetFilters = () => {
    setAsunto('');
    setEstado('');
    setRubro('');
    setFechaDesde('');
    setFechaHasta('');
    // Al setear en vacío, se debería hacer el fetch, pero react state es asíncrono
    // Pasamos los params en blanco directo al listarCampanas o usamos el useEffect.
    // Lo más sencillo es un fetch manual con filtros limpios:
    setLoading(true);
    listarCampanas({}).then(res => {
      if (res.success && res.data) setCampanas(res.data);
      setLoading(false);
    });
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 overflow-hidden rounded-[14px] shadow-sm shrink-0 mt-0.5">
            <img src={logo3f} alt="Logo 3F" className="w-full h-full object-cover scale-[1.15]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              Dirección de Producción: Campañas de Correo
            </h1>
            <p className="text-muted mt-1">
              Gestioná y monitoreá el estado de los envíos masivos.
            </p>
          </div>
        </div>
        {puedeCrear && (
          <button
            onClick={() => navigate('/nueva')}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm"
          >
            <Plus size={20} />
            Nueva Campaña
          </button>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="bg-surface p-4 rounded-xl shadow-sm border border-border mb-6 transition-colors">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-muted mb-1.5">Buscar Asunto</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                type="text"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Ej: Taller para Pymes..."
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors h-[42px]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted mb-1.5">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full pl-3.5 pr-6 py-2.5 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors h-[42px]"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted mb-1.5">Rubro</label>
            <select
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
              className="w-full pl-3.5 pr-8 py-2.5 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors h-[42px]"
            >
              <option value="">Todos los rubros</option>
              {RUBROS_LIST.map((r) => (
                <option key={r} value={r}>{RUBROS_LABELS[r] || r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted mb-1.5">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors h-[42px]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted mb-1.5">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors h-[42px]"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 md:col-span-6 lg:col-span-2">
            <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-secondary text-white font-medium rounded-lg hover:bg-secondary-dark transition-colors shadow-sm text-sm h-[40px] whitespace-nowrap">
              <Filter size={18} />
              Aplicar Filtros
            </button>
            <button type="button" onClick={handleResetFilters} className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-danger text-white font-medium rounded-lg hover:bg-danger-dark transition-colors shadow-sm text-sm h-[40px] whitespace-nowrap">
              <RotateCcw size={18} />
              Restablecer Filtros
            </button>
          </div>
        </form>
      </div>

      {/* Tabla de Campañas */}
      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted">
            <thead className="bg-background text-dark text-xs uppercase font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-4">Asunto</th>
                <th className="px-6 py-4">Destinatarios</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Fecha Límite</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted">
                    <div className="animate-pulse flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3"></div>
                      Cargando campañas...
                    </div>
                  </td>
                </tr>
              ) : campanas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted">
                    No se encontraron campañas.
                  </td>
                </tr>
              ) : (
                campanas.map((campana) => {
                  const rubrosDisplay = campana.para_todos_rubros
                    ? 'Todos los rubros'
                    : campana.rubros_seleccionados.length > 0
                      ? campana.rubros_seleccionados.map((r) => RUBROS_LABELS[r] || r).join(', ')
                      : 'Ninguno';

                  return (
                    <tr key={campana.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-dark max-w-xs truncate" title={campana.asunto}>
                        {campana.asunto}
                      </td>
                      <td className="px-6 py-4 max-w-[200px] truncate" title={rubrosDisplay}>
                        {rubrosDisplay}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${ESTADO_BADGE_CLASSES[campana.estado] || 'bg-slate-100'}`}>
                          {ESTADO_LABELS[campana.estado] || campana.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {campana.fecha_limite_envio ? formatDate(campana.fecha_limite_envio) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => navigate(`/campanas/${campana.id}`)}
                          className="text-primary hover:text-primary-dark font-medium hover:underline text-sm"
                        >
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
