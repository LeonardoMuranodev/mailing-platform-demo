import React, { useEffect, useState } from 'react';
import { Search, Filter, RotateCcw, Upload, Download, Plus, Edit2, Trash2, X, Building2, AlertCircle } from 'lucide-react';
import {
  obtenerContactos,
  crearContacto,
  actualizarContacto,
  eliminarContacto,
  eliminarContactosBulk,
  syncContactosSheets,
  checkSyncStatus
} from '../services/api';
import type { ContactoConRubro, CrearContactoInput } from '../types/contacto';
import { RUBROS_LABELS, RUBROS_LIST } from '../data/rubros';
import { usePermisos } from '../hooks/usePermisos';
import AlertMessage from './ui/AlertMessage';
import ImportadorVisual from './ImportadorVisual';

export default function DirectorioContactos() {
  const [contactos, setContactos] = useState<ContactoConRubro[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { puedeCrear, puedeEditar, puedeEliminar } = usePermisos();

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [rubroId, setRubroId] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CrearContactoInput>({
    email: '',
    empresa_nombre: '',
    cuit: '',
    rubro_id: '',
    estado: 'funcional',
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Autocompletado empresa
  const [empresasSugeridas, setEmpresasSugeridas] = useState<Array<{ id: string; nombre: string; cuit: string | null }>>([]);
  const [showEmpresaSugeridas, setShowEmpresaSugeridas] = useState(false);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  const buscarEmpresasSugeridas = async (q: string) => {
    if (!q || q.length < 2) { setEmpresasSugeridas([]); setShowEmpresaSugeridas(false); return; }
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_BASE}/empresas?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (data.success) { setEmpresasSugeridas(data.data); setShowEmpresaSugeridas(data.data.length > 0); }
    } catch { setEmpresasSugeridas([]); }
  };

  // Confirm Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sync Sheets
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchContactosData = async (currentPage = page) => {
    setLoading(true);
    try {
      const res = await obtenerContactos({
        page: currentPage,
        limit,
        busqueda,
        estado,
        rubro_id: rubroId
      });
      if (res.success && res.data) {
        setContactos(res.data.data || []);
        setTotal(res.data.total || 0);
      } else {
        setContactos([]);
        setTotal(0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactosData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (page === 1) fetchContactosData(1);
    else setPage(1);
  };

  const handleResetFilters = () => {
    setBusqueda('');
    setEstado('');
    setRubroId('');
    if (page === 1) {
      setLoading(true);
      obtenerContactos({ page: 1, limit }).then(res => {
        if (res.success && res.data) {
          setContactos(res.data.data);
          setTotal(res.data.total);
        }
        setLoading(false);
      });
    } else {
      setPage(1);
    }
  };

  const activasLocales = contactos.filter(c => c.estado === 'funcional').length;
  const rebotadasLocales = contactos.filter(c => c.estado.includes('rebotado')).length;

  const handleExportCsv = () => {
    const header = ['Empresa', 'Email', 'CUIT', 'Rubro', 'Estado', 'Creado'];
    const rows = contactos.map(c => [
      c.empresa_nombre || '',
      c.email,
      c.cuit || '',
      c.rubro_nombre || '',
      c.estado,
      new Date(c.creado_en).toLocaleDateString()
    ]);

    const csvContent = [
      header.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'contactos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncSheets = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncContactosSheets();
      if (!res.success) {
        setSyncResult({ success: false, message: res.error?.message || 'Error al iniciar sincronización' });
        setIsSyncing(false);
      }
      // If success, the polling useEffect will take over
    } catch (e: any) {
      setSyncResult({ success: false, message: e.message || 'Error de red al sincronizar' });
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const checkStatus = async () => {
      try {
        const res = await checkSyncStatus();
        if (res.success && res.data) {
          const data = res.data as any;
          if (data.isSyncing) {
            setIsSyncing(true);
          } else {
            // Terminó la sincronización o no hay ninguna en curso
            setIsSyncing(false);
            if (data.lastResult) {
              setSyncResult({
                success: data.lastResult.success,
                message: data.lastResult.message
              });
              if (data.lastResult.success) {
                fetchContactosData(1);
                setPage(1);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error al consultar estado de sincronización', err);
      }
    };

    // Check status inmediately on mount
    checkStatus();

    // Setup polling every 3 seconds if syncing
    if (isSyncing) {
      interval = setInterval(checkStatus, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSyncing]);

  const openCrearModal = () => {
    setEditingId(null);
    setForm({ email: '', empresa_nombre: '', cuit: '', rubro_id: '', estado: 'funcional', tipo: '' });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditarModal = (c: ContactoConRubro) => {
    setEditingId(c.id);
    setForm({
      email: c.email,
      empresa_nombre: c.empresa_nombre || '',
      cuit: c.cuit || '',
      rubro_id: c.rubro_id || '',
      estado: c.estado,
      tipo: c.tipo || '',
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);

    try {
      const payload = { ...form };
      if (!payload.rubro_id) payload.rubro_id = null;

      if (editingId) {
        const res = await actualizarContacto(editingId, payload);
        if (res.success && res.data) {
          fetchContactosData();
          setIsModalOpen(false);
        } else {
          let msg = res.error?.message || 'Error al actualizar';
          if (res.error?.details && Array.isArray(res.error.details)) {
            msg += ': ' + res.error.details.map((d: any) => d.message).join(', ');
          }
          setErrorMsg(msg);
        }
      } else {
        const res = await crearContacto(payload);
        if (res.success && res.data) {
          setPage(1);
          await fetchContactosData(1);
          setIsModalOpen(false);
        } else {
          let msg = res.error?.message || 'Error al crear';
          if (res.error?.details && Array.isArray(res.error.details)) {
            msg += ': ' + res.error.details.map((d: any) => d.message).join(', ');
          }
          setErrorMsg(msg);
        }
      }
    } catch (e) {
      setErrorMsg('Error de red');
    } finally {
      setSaving(false);
    }
  };

  const confirmEliminar = async () => {
    if (!deleteConfirmId) return;
    const res = await eliminarContacto(deleteConfirmId);
    if (res.success) {
      fetchContactosData();
    }
    setDeleteConfirmId(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    setBulkDeleting(true);
    try {
      const res = await eliminarContactosBulk(selectedIds);
      if (res.success) {
        setSelectedIds([]);
        await fetchContactosData();
      } else {
        alert(res.error?.message || 'Error al eliminar los contactos');
      }
    } catch (e) {
      alert('Error de red al eliminar contactos');
    } finally {
      setBulkDeleting(false);
      setBulkDeleteConfirm(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };


  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 pr-4 sm:pr-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Building2 className="w-7 h-7" />
            Directorio de Empresas y Contactos
          </h1>
          <p className="text-muted mt-1 text-sm">
            Gestioná la base de datos de empresas, filtrá por rubro y exportá contactos.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-wrap justify-end">
          {puedeCrear && (
            <>
              <button
                onClick={handleSyncSheets}
                disabled={isSyncing}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-500 rounded-lg hover:bg-green-500/20 transition-colors font-medium shadow-sm w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSyncing ? (
                  <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                )}
                Sincronizar con Sheets
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-surface border border-border text-dark rounded-lg hover:bg-background transition-colors font-medium shadow-sm w-full sm:w-auto"
              >
                <Upload size={18} />
                Importar CSV
              </button>
              <button
                onClick={openCrearModal}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors font-medium shadow-sm w-full sm:w-auto"
              >
                <Plus size={18} />
                Crear Contacto
              </button>
            </>
          )}
          <button
            onClick={handleExportCsv}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-surface border border-border text-dark rounded-lg hover:bg-background transition-colors font-medium shadow-sm w-full sm:w-auto"
          >
            <Download size={18} />
            Exportar
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="mb-6">
          <AlertMessage
            type={syncResult.success ? "success" : "error"}
            message={syncResult.message}
            onClose={() => setSyncResult(null)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-muted font-medium">Total Contactos</p>
            <h3 className="text-2xl font-bold text-dark">{total}</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Building2 size={20} />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex items-center justify-between opacity-80">
          <div>
            <p className="text-sm text-muted font-medium">Activas (Página)</p>
            <h3 className="text-2xl font-bold text-dark">{activasLocales}</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success">
            <AlertCircle size={20} />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex items-center justify-between opacity-80">
          <div>
            <p className="text-sm text-muted font-medium">Rebotadas (Página)</p>
            <h3 className="text-2xl font-bold text-dark">{rebotadasLocales}</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center text-danger">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      <div className="bg-surface p-4 rounded-xl shadow-sm border border-border mb-6 transition-colors">
        <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4 items-end w-full">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-muted mb-1.5">Buscar Contacto</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, email o CUIT..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors h-[42px]"
              />
            </div>
          </div>
          <div className="w-full lg:w-[200px]">
            <label className="block text-sm font-semibold text-muted mb-1.5">Rubro</label>
            <select
              value={rubroId}
              onChange={(e) => setRubroId(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors h-[42px]"
            >
              <option value="">Todos los rubros</option>
              {RUBROS_LIST.map((r) => (
                <option key={r} value={r}>{RUBROS_LABELS[r] || r}</option>
              ))}
            </select>
          </div>
          <div className="w-full lg:w-[200px]">
            <label className="block text-sm font-semibold text-muted mb-1.5">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors h-[42px]"
            >
              <option value="">Todos los estados</option>
              <option value="funcional">Funcional</option>
              <option value="inactivo">Inactivo</option>
              <option value="rebotado inexistente">Rebotado Inexistente</option>
              <option value="rebotado bandeja llena">Rebotado Bandeja Llena</option>
              <option value="rebotado spam">Rebotado SPAM</option>
              <option value="rebotado desconocido">Rebotado Desconocido</option>
            </select>
          </div>
          <div className="flex flex-row gap-3 w-full lg:w-auto">
            <button type="submit" className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-secondary text-white font-medium rounded-lg hover:bg-secondary-dark transition-colors shadow-sm text-sm h-[42px] whitespace-nowrap">
              <Filter size={18} />
              Aplicar
            </button>
            <button type="button" onClick={handleResetFilters} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-danger text-white hover:bg-danger-dark font-medium rounded-lg transition-colors shadow-sm text-sm h-[42px] whitespace-nowrap">
              <RotateCcw size={18} />
              Restablecer
            </button>
          </div>
        </form>
      </div>

      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted">
            <thead className="bg-background text-dark text-xs uppercase font-semibold border-b border-border">
              <tr>
                {puedeEliminar && <th className="px-6 py-4 w-12"></th>}
                <th className="px-6 py-4">Empresa / Razón Social</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">CUIT</th>
                <th className="px-6 py-4">Rubro</th>
                <th className="px-6 py-4">Estado</th>
                {(puedeEditar || puedeEliminar) && <th className="px-6 py-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted">
                    <div className="animate-pulse flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3"></div>
                      Cargando contactos...
                    </div>
                  </td>
                </tr>
              ) : contactos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted">
                    No se encontraron contactos.
                  </td>
                </tr>
              ) : (
                contactos.map((c) => {
                  const estadoBadge =
                    c.estado === 'funcional' ? 'bg-[#16A34A] text-white' :
                      c.estado === 'inactivo' ? 'bg-gray-500 text-white' :
                        c.estado.includes('rebotado') ? 'bg-[#DC2626] text-white' :
                          'bg-gray-500 text-white';

                  return (
                    <tr key={c.id} className={`hover:bg-background/50 transition-colors ${selectedIds.includes(c.id) ? 'bg-primary/5' : ''}`}>
                      {puedeEliminar && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => toggleSelect(c.id)}
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 font-medium text-dark max-w-[200px] truncate" title={c.empresa_nombre || '-'}>
                        {c.empresa_nombre || '-'}
                      </td>
                      <td className="px-6 py-4 text-dark max-w-[200px] truncate" title={c.email}>
                        {c.email}
                      </td>
                      <td className="px-6 py-4">
                        {c.cuit || '-'}
                      </td>
                      <td className="px-6 py-4 max-w-[150px] truncate" title={c.rubro_nombre || '-'}>
                        <span className="bg-background border border-border px-2 py-1 rounded text-xs">
                          {c.rubro_nombre || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md shadow-sm ${estadoBadge}`}
                        >
                          {c.estado ? c.estado.charAt(0).toUpperCase() + c.estado.slice(1) : '-'}
                        </span>
                      </td>
                      {(puedeEditar || puedeEliminar) && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {puedeEditar && (
                              <button
                                onClick={() => openEditarModal(c)}
                                className="p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                                title="Editar contacto"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {puedeEliminar && (
                              <button
                                onClick={() => setDeleteConfirmId(c.id)}
                                className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                                title="Eliminar contacto"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
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

        {puedeEliminar && selectedIds.length > 0 && (
          <div className="px-6 py-3 border-t border-border bg-danger/5 flex items-center justify-between">
            <span className="text-sm font-medium text-dark">
              {selectedIds.length} contacto{selectedIds.length > 1 ? 's' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedIds([])}
                className="px-4 py-2 text-sm font-medium text-dark bg-background border border-border rounded-lg hover:bg-surface transition-colors"
              >
                Deseleccionar
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(true)}
                disabled={bulkDeleting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-danger text-white rounded-lg hover:bg-danger-dark transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
                Eliminar Seleccionados
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-lg rounded-xl border border-border shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold text-dark">{editingId ? 'Editar Contacto' : 'Nuevo Contacto'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-dark">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardar} className="p-6 space-y-4" noValidate>
              <AlertMessage type="error" message={errorMsg} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Email - full width */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-dark mb-1">Email <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                    placeholder="ejemplo@empresa.com"
                  />
                </div>

                {/* Empresa - full width con autocompletado */}
                <div className="sm:col-span-2" style={{ position: 'relative' }}>
                  <label className="block text-sm font-medium text-dark mb-1">Empresa / Razón Social</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={form.empresa_nombre || ''}
                    onChange={e => {
                      setForm({ ...form, empresa_nombre: e.target.value });
                      buscarEmpresasSugeridas(e.target.value);
                    }}
                    onBlur={() => setTimeout(() => setShowEmpresaSugeridas(false), 150)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                    placeholder="Nombre de la empresa (busca entre existentes)"
                  />
                  {showEmpresaSugeridas && empresasSugeridas.length > 0 && (
                    <ul className="absolute z-50 w-full bg-surface border border-border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {empresasSugeridas.map(emp => (
                        <li
                          key={emp.id}
                          className="px-3 py-2 hover:bg-primary/10 cursor-pointer text-dark flex justify-between items-center"
                          onMouseDown={() => {
                            setForm(f => ({ ...f, empresa_nombre: emp.nombre, cuit: emp.cuit || f.cuit }));
                            setShowEmpresaSugeridas(false);
                          }}
                        >
                          <span>{emp.nombre}</span>
                          {emp.cuit && <span className="text-muted text-xs">{emp.cuit}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* CUIT - full width */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-dark mb-1">CUIT</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.cuit || ''}
                    onChange={e => setForm({ ...form, cuit: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                    placeholder="Sin guiones (ej: 30709328995)"
                    maxLength={11}
                  />
                </div>

                {/* Estado y Tipo - lado a lado */}
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Estado</label>
                  <select
                    value={form.estado}
                    onChange={e => setForm({ ...form, estado: e.target.value as any })}
                    className="w-full pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                  >
                    <option value="funcional">Funcional</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="rebotado inexistente">Rebotado Inexistente</option>
                    <option value="rebotado bandeja llena">Rebotado Bandeja Llena</option>
                    <option value="rebotado spam">Rebotado SPAM</option>
                    <option value="rebotado desconocido">Rebotado Desconocido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Tipo de Contacto</label>
                  <select
                    value={form.tipo || ''}
                    onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                  >
                    <option value="">Sin tipo asignado</option>
                    <option value="principal">Principal</option>
                    <option value="secundario">Secundario</option>
                  </select>
                </div>

                {/* Rubro - full width */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-dark mb-1">Rubro</label>
                  <select
                    value={form.rubro_id || ''}
                    onChange={e => setForm({ ...form, rubro_id: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                  >
                    <option value="">Sin rubro asignado</option>
                    {RUBROS_LIST.map(r => (
                      <option key={r} value={r}>{RUBROS_LABELS[r] || r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border bg-background text-dark rounded-lg hover:bg-surface font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium transition-colors disabled:opacity-70 flex items-center gap-2"
                >
                  {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                  {editingId ? 'Guardar Cambios' : 'Crear Contacto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <ImportadorVisual
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={() => { setIsImportModalOpen(false); setPage(1); fetchContactosData(1); }}
        />
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm p-6 animate-fade-in border border-border text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-danger/10 mb-4">
              <Trash2 className="h-6 w-6 text-danger" />
            </div>
            <h3 className="text-lg font-semibold text-dark mb-2">¿Eliminar contacto?</h3>
            <p className="text-sm text-muted mb-6">
              Esta acción no se puede deshacer. Se borrarán los datos del directorio.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-dark bg-background border border-border rounded-lg hover:bg-surface transition-colors w-full"
              >
                Cancelar
              </button>
              <button
                onClick={confirmEliminar}
                className="px-4 py-2 text-sm font-medium text-white bg-danger rounded-lg hover:bg-danger-dark transition-colors w-full"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación Masiva */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm p-6 animate-fade-in border border-border text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-danger/10 mb-4">
              <Trash2 className="h-6 w-6 text-danger" />
            </div>
            <h3 className="text-lg font-semibold text-dark mb-2">
              ¿Eliminar {selectedIds.length} contacto{selectedIds.length > 1 ? 's' : ''}?
            </h3>
            <p className="text-sm text-muted mb-6">
              Esta acción no se puede deshacer. Se borrarán los datos de {selectedIds.length} contacto{selectedIds.length > 1 ? 's' : ''} del directorio.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-dark bg-background border border-border rounded-lg hover:bg-surface transition-colors w-full"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-danger rounded-lg hover:bg-danger-dark transition-colors w-full disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkDeleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                Sí, Eliminar Todos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
