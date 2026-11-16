import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, RotateCcw, CalendarIcon, Trash2, Archive, HelpCircle, Edit3, CheckCircle2, Play, Pause, RefreshCcw, Mail } from 'lucide-react';
import { listarCampanas, eliminarCampana, archivarCampana, desarchivarCampana, eliminarCampanasMasivo, cambiarEstadoCampana } from '../services/api';
import type { CampanaResponse } from '../types/campana';
import { usePermisos } from '../hooks/usePermisos';
import { useNotificationStore } from '../stores/useNotificationStore';
import { formatDate } from '../utils/formatDate';
import { RUBROS_LABELS, RUBROS_LIST } from '../data/rubros';
import { useCampanaStore } from '../stores/campanaStore';
import Modal from './ui/Modal';
import ConfirmModal from './ui/ConfirmModal';
import TablePagination from './ui/TablePagination';
import CampanaBadge, { CAMPANA_ESTADO_LABELS as ESTADO_LABELS } from './ui/CampanaBadge';
import Spinner from './ui/Spinner';
import CustomSelect from './ui/CustomSelect';

export default function ListaCampanas() {
  const navigate = useNavigate();
  const { puedeCrear, puedeEditar, puedeEliminar } = usePermisos();
  const { agregarNotificacion } = useNotificationStore();
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

  const estadoOptions = useMemo(() => [
    { value: '', label: 'Todos los estados' },
    ...Object.entries(ESTADO_LABELS).map(([val, label]) => ({ value: val, label })),
  ], []);

  const rubroOptions = useMemo(() => [
    { value: '', label: 'Todos los rubros' },
    { value: '__sin_rubro__', label: 'Sin Rubro' },
    ...RUBROS_LIST.map((r) => ({ value: r, label: RUBROS_LABELS[r] || r })),
  ], []);

  // Confirm Delete / Archive
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);

  // Bulk Delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Bloquear scroll del fondo cuando hay modal abierto
  useEffect(() => {
    const isAnyModalOpen = Boolean(deleteConfirmId || archiveConfirmId || showBulkDeleteConfirm || showHelp);
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [deleteConfirmId, archiveConfirmId, showBulkDeleteConfirm, showHelp]);

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

  const handleRestore = async (id: string) => {
    try {
      const res = await desarchivarCampana(id);
      if (res.success) {
        fetchCampanas();
      }
    } catch (error) {
      console.error('Error al restaurar campaña:', error);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await cambiarEstadoCampana(id, newStatus);
      if (res.success) {
        fetchCampanas();
      } else {
        const msg = res.error?.message || 'Error al cambiar el estado de la campaña';
        agregarNotificacion({
          tipo: 'general',
          titulo: 'No se puede cambiar el estado',
          mensaje: msg,
          timestamp: new Date().toISOString(),
        });
        alert(msg);
      }
    } catch (error: any) {
      console.error('Error al cambiar el estado de la campaña:', error);
      alert(error.message || 'Error inesperado al cambiar estado');
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
          <div className="w-11 h-11 overflow-hidden rounded-[14px] shadow-sm shrink-0 mt-0.5 bg-primary/10 flex items-center justify-center text-primary border border-primary/20"><Mail size={22} className="text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              GenMailer: Plataforma de Campañas
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
              onClick={() => { useCampanaStore.getState().reset(); navigate('/nueva'); }}
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
            <CustomSelect
              value={estado}
              onChange={setEstado}
              options={estadoOptions}
              size="md"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted mb-1.5">Rubro</label>
            <CustomSelect
              value={rubro}
              onChange={setRubro}
              options={rubroOptions}
              size="md"
            />
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
                      <Spinner size="md" color="primary" className="mb-3" />
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
                  const rubrosDisplay = campana.tipo_audiencia === 'manual'
                    ? `Destinatarios específicos (${(campana.destinatarios_manuales || []).length})`
                    : campana.para_todos_rubros
                      ? 'Todos los rubros'
                      : Array.isArray(campana.rubros_seleccionados)
                        ? (campana.rubros_seleccionados || []).map((r) => r === '__sin_rubro__' ? 'Sin Rubro' : RUBROS_LABELS[r] || r).join(', ')
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
                        {estado === 'archivada' ? (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                            Archivada ({ESTADO_LABELS[campana.estado] || campana.estado})
                          </span>
                        ) : (
                          <CampanaBadge estado={campana.estado} />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon size={14} />
                          {campana.fecha_limite_envio ? formatDate(campana.fecha_limite_envio) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          {puedeEditar && campana.estado === 'borrador' && (
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
                          {puedeEditar && campana.estado === 'en_proceso' && (
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
                          {puedeEditar && campana.estado === 'pausada' && (
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
                          {puedeEliminar && estado !== 'archivada' && (
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
                          )}
                          {puedeEditar && estado === 'archivada' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestore(campana.id);
                              }}
                              className="p-1.5 text-muted hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Restaurar campaña archivada"
                            >
                              <RefreshCcw size={16} />
                            </button>
                          )}
                          {puedeEliminar && (
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
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </div>

      {/* Modal de Confirmación de Eliminación */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="¿Eliminar campaña?"
        description="Estás a punto de eliminar esta campaña. Se borrará todo su historial y estadísticas. Esta acción no se puede deshacer."
        confirmText="Sí, Eliminar Físicamente"
        variant="danger"
      />

      {/* Modal de Confirmación de Archivar */}
      <ConfirmModal
        isOpen={Boolean(archiveConfirmId)}
        onClose={() => setArchiveConfirmId(null)}
        onConfirm={handleArchive}
        title="¿Archivar campaña?"
        description={
          <span>
            La campaña desaparecerá de esta lista, pero <strong>sus envíos seguirán sumando en las estadísticas globales</strong>. Esta acción no se puede deshacer.
          </span>
        }
        confirmText="Sí, Archivar"
        variant="info"
      />

      {/* Modal de Confirmación de Eliminación Masiva */}
      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={`¿Eliminar ${selectedIds.size} campañas?`}
        description={`Estás a punto de eliminar ${selectedIds.size} campañas seleccionadas. Se borrará todo su historial y estadísticas. Esta acción no se puede deshacer.`}
        confirmText="Sí, Eliminar Todas"
        variant="danger"
      />

      {/* Modal de Ayuda */}
      <Modal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        maxWidth="lg"
        title={
          <span className="flex items-center gap-2">
            <HelpCircle size={20} className="text-primary" />
            Guía de Gestión de Campañas
          </span>
        }
      >
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
            className="py-2 px-5 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </Modal>
    </div>
  );
}
