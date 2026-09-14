import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, RotateCcw, CalendarIcon, Trash2, AlertTriangle, Archive, Info, HelpCircle, X, Edit3, CheckCircle2, Play, Pause } from 'lucide-react';
import { listarCampanas, eliminarCampana, archivarCampana, eliminarCampanasMasivo, cambiarEstadoCampana } from '../services/api';
import type { CampanaResponse } from '../types/campana';
import { usePermisos } from '../hooks/usePermisos';
import { formatDate } from '../utils/formatDate';
import { RUBROS_LABELS, RUBROS_LIST } from '../data/rubros';
import logo3f from '../assets/logo-3f.png';

const ESTADO_BADGE_CLASSES: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-600 border border-slate-200',
  aprobada: 'bg-blue-50 text-blue-700 border border-blue-200',
  en_proceso: 'bg-amber-50 text-amber-700 border border-amber-200',
  pausada: 'bg-orange-50 text-orange-700 border border-orange-200',
  completada: 'bg-green-50 text-green-700 border border-green-200',
  cancelada: 'bg-red-50 text-red-700 border border-red-200',
};

const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  aprobada: 'Aprobada',
  en_proceso: 'En Proceso',
  pausada: 'Pausada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function ListaCampanas() {
  const navigate = useNavigate();
  const { puedeCrear } = usePermisos();
  const [campanas, setCampanas] = useState<CampanaResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Paginación
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Filtros
  const [asunto, setAsunto] = useState('');
  const [estado, setEstado] = useState('');
  const [rubro, setRubro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  
  // Confirm Delete / Archive
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);

  // Bulk Delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const fetchCampanas = useCallback(async (currentPage = page) => {
    setLoading(true);
    try {
      const res = await listarCampanas({ 
        asunto, estado, rubro, fecha_desde: fechaDesde, fecha_hasta: fechaHasta, page: currentPage, limit 
      });
      if (res.success && res.data) {
        setCampanas(res.data.data || []);
        setTotal(res.data.total || 0);
      } else {
        setCampanas([]);
        setTotal(0);
      }
      setSelectedIds(new Set()); // Reset selections on new fetch
    } catch (error) {
      console.error('Error al listar campañas:', error);
    } finally {
      setLoading(false);
    }
  }, [asunto, estado, rubro, fechaDesde, fechaHasta, limit, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCampanas(1);
  };

  const handleResetFilters = () => {
    setAsunto('');
    setEstado('');
    setRubro('');
    setFechaDesde('');
    setFechaHasta('');
    setPage(1);
    setLoading(true);
    listarCampanas({ page: 1, limit }).then(res => {
      if (res.success && res.data) {
        setCampanas(res.data.data || []);
        setTotal(res.data.total || 0);
      } else {
        setCampanas([]);
        setTotal(0);
      }
      setSelectedIds(new Set());
      setLoading(false);
    });
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedIds.size === campanas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(campanas.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await eliminarCampanasMasivo(Array.from(selectedIds));
      if (res.success) {
        setShowBulkDeleteConfirm(false);
        fetchCampanas(); // Refetch to update pagination correctly
      }
    } catch (error) {
      console.error('Error al eliminar campañas masivamente', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const res = await eliminarCampana(deleteConfirmId);
      if (res.success) {
        fetchCampanas();
        setDeleteConfirmId(null);
      }
    } catch (error) {
      console.error('Error al eliminar campaña:', error);
    }
  };

  const handleArchive = async () => {
    if (!archiveConfirmId) return;
    try {
      const res = await archivarCampana(archiveConfirmId);
      if (res.success) {
        fetchCampanas();
        setArchiveConfirmId(null);
      }
    } catch (error) {
      console.error('Error al archivar campaña:', error);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await cambiarEstadoCampana(id, newStatus);
      if (res.success) {
        fetchCampanas();
      }
    } catch (error) {
      console.error('Error al cambiar el estado de la campaña:', error);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    fetchCampanas(page);
  }, [page, limit, fetchCampanas]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 w-full">
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {puedeCrear && selectedIds.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center justify-center gap-2 bg-danger text-white px-5 py-2.5 rounded-lg hover:bg-danger-dark transition-colors font-medium shadow-sm w-full sm:w-auto"
            >
              <Trash2 size={20} />
              Borrar Seleccionadas ({selectedIds.size})
            </button>
          )}
          {puedeCrear && (
            <button
              onClick={() => navigate('/nueva')}
              className="flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm w-full sm:w-auto"
            >
              <Plus size={20} />
              Nueva Campaña
            </button>
          )}
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center justify-center gap-2 bg-surface text-dark border border-border px-3 py-2.5 rounded-lg hover:bg-background transition-colors font-medium shadow-sm w-full sm:w-auto"
            title="Ayuda sobre Archivar y Eliminar"
          >
            <HelpCircle size={20} className="text-primary" />
          </button>
        </div>
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
                <th className="px-6 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    checked={selectedIds.size > 0 && selectedIds.size === campanas.length}
                    onChange={toggleAllSelection}
                  />
                </th>
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
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    <div className="animate-pulse flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3"></div>
                      Cargando campañas...
                    </div>
                  </td>
                </tr>
              ) : campanas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    No se encontraron campañas.
                  </td>
                </tr>
              ) : (
                campanas.map((campana) => {
                  const rubrosDisplay = campana.para_todos_rubros
                    ? 'Todos los rubros'
                    : Array.isArray(campana.rubros_seleccionados)
                      ? campana.rubros_seleccionados.map((r) => r === '__sin_rubro__' ? 'Sin Rubro' : RUBROS_LABELS[r] || r).join(', ')
                      : 'Ninguno';

                  return (
                    <tr 
                      key={campana.id} 
                      onClick={() => navigate(`/campanas/${campana.id}`)}
                      className="hover:bg-background/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          checked={selectedIds.has(campana.id)}
                          onChange={() => toggleSelection(campana.id)}
                        />
                      </td>
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
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon size={14} />
                          {campana.fecha_limite_envio ? formatDate(campana.fecha_limite_envio) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          {campana.estado === 'borrador' && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/campanas/editar/${campana.id}`);
                                }}
                                className="p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                title="Editar campaña"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(campana.id, 'aprobada');
                                }}
                                className="p-1.5 text-muted hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Aprobar campaña"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            </>
                          )}
                          {campana.estado === 'en_proceso' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(campana.id, 'pausada');
                              }}
                              className="p-1.5 text-muted hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Pausar envíos"
                            >
                              <Pause size={16} />
                            </button>
                          )}
                          {campana.estado === 'pausada' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(campana.id, 'en_proceso');
                              }}
                              className="p-1.5 text-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Reanudar envíos"
                            >
                              <Play size={16} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setArchiveConfirmId(campana.id);
                            }}
                            className="p-1.5 text-muted hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Archivar campaña (oculta de la lista pero mantiene estadísticas)"
                          >
                            <Archive size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(campana.id);
                            }}
                            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar definitivamente (borra historial y estadísticas)"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="px-4 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between bg-background gap-4">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-center sm:text-left">
              <span className="text-sm text-muted whitespace-nowrap">
                Página <span className="font-medium text-dark">{page}</span> de <span className="font-medium text-dark">{totalPages}</span>
              </span>
              <div className="flex items-center gap-2">
                <label htmlFor="limit" className="text-sm text-muted whitespace-nowrap">Mostrar:</label>
                <select
                  id="limit"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 bg-background border border-border rounded text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="flex justify-center gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex-1 sm:flex-none px-3 py-1.5 border border-border rounded-md text-sm font-medium text-dark disabled:opacity-50 hover:bg-surface transition-colors text-center"
              >
                Anterior
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex-1 sm:flex-none px-3 py-1.5 border border-border rounded-md text-sm font-medium text-dark disabled:opacity-50 hover:bg-surface transition-colors text-center"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Eliminación */}
      {deleteConfirmId && (
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
                Estás a punto de eliminar esta campaña. Se borrará todo su historial y estadísticas. Esta acción no se puede deshacer.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 px-4 bg-surface border border-border text-dark rounded-lg font-medium hover:bg-border transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Sí, Eliminar Físicamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Archivar */}
      {archiveConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="bg-blue-100 p-3 rounded-full">
                  <Info size={32} className="text-blue-600" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-center text-dark mb-2">
                ¿Archivar campaña?
              </h3>
              <p className="text-center text-muted mb-6">
                La campaña desaparecerá de esta lista, pero <strong>sus envíos seguirán sumando en las estadísticas globales</strong>. Esta acción no se puede deshacer.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setArchiveConfirmId(null)}
                  className="flex-1 py-2.5 px-4 bg-surface border border-border text-dark rounded-lg font-medium hover:bg-border transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleArchive}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Sí, Archivar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación Masiva */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="bg-red-100 p-3 rounded-full">
                  <AlertTriangle size={32} className="text-red-600" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-center text-dark mb-2">
                ¿Eliminar {selectedIds.size} campañas?
              </h3>
              <p className="text-center text-muted mb-6">
                Estás a punto de eliminar {selectedIds.size} campañas seleccionadas. Se borrará todo su historial y estadísticas. Esta acción no se puede deshacer.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-surface border border-border text-dark rounded-lg font-medium hover:bg-border transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm"
                >
                  Sí, Eliminar Todas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ayuda */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-dark flex items-center gap-2">
                  <HelpCircle size={20} className="text-primary" />
                  Guía de Gestión de Campañas
                </h3>
                <button onClick={() => setShowHelp(false)} className="text-muted hover:text-dark transition-colors p-1 rounded-md hover:bg-background">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-sm">
                <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-blue-100 p-1.5 rounded-md text-blue-700">
                      <Archive size={16} />
                    </div>
                    <p className="font-semibold text-blue-800">¿Qué significa Archivar?</p>
                  </div>
                  <p className="text-blue-900/80 leading-relaxed ml-9">
                    Utilizá esta opción cuando una campaña <strong>ya finalizó sus envíos</strong> y no necesitás verla más en esta lista.
                    Al archivar, la campaña se oculta, pero <strong>sus métricas (envíos, rebotes, aperturas) se siguen sumando</strong> en los gráficos estadísticos del Dashboard.
                  </p>
                </div>

                <div className="bg-red-50/50 border border-red-200/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-red-100 p-1.5 rounded-md text-red-700">
                      <Trash2 size={16} />
                    </div>
                    <p className="font-semibold text-red-800">¿Qué significa Eliminar?</p>
                  </div>
                  <p className="text-red-900/80 leading-relaxed ml-9">
                    Utilizá esta opción <strong>solo si te equivocaste al crear la campaña</strong> (por ejemplo, le pifiaste al rubro o al asunto). 
                    Al eliminarla, <strong>se borra por completo y deja de contar en las estadísticas generales</strong>. ¡Esta acción no se puede deshacer!
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowHelp(false)}
                  className="py-2 px-5 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
