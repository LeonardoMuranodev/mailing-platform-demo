import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Plus, Search, Filter } from 'lucide-react';
import { listarCampanas } from '../services/api';
import type { CampanaResponse } from '../types/campana';
import { formatDate } from '../utils/formatDate';
import { RUBROS_LABELS } from '../data/rubros';

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
  const [campanas, setCampanas] = useState<CampanaResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [asunto, setAsunto] = useState('');
  const [estado, setEstado] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const fetchCampanas = async () => {
    setLoading(true);
    try {
      const res = await listarCampanas({ asunto, estado, fecha_desde: fechaDesde, fecha_hasta: fechaHasta });
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

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Mail className="text-primary" />
            Campañas de Correo
          </h1>
          <p className="text-slate-500 mt-1">
            Gestioná y monitoreá el estado de los envíos masivos.
          </p>
        </div>
        <button
          onClick={() => navigate('/nueva')}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm"
        >
          <Plus size={20} />
          Nueva Campaña
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Buscar Asunto</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Ej: Taller para Pymes..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
            />
          </div>
          <div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 px-4 py-2 rounded-lg transition-colors font-medium text-sm">
              <Filter size={18} />
              Filtrar
            </button>
          </div>
        </form>
      </div>

      {/* Tabla de Campañas */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Asunto</th>
                <th className="px-6 py-4">Destinatarios</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Fecha Límite</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="animate-pulse flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3"></div>
                      Cargando campañas...
                    </div>
                  </td>
                </tr>
              ) : campanas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
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
                    <tr key={campana.id} className="hover:bg-slate-50/50 transition-colors">
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
