import { useEffect, useState, useMemo } from 'react';
import { Search, Filter, RotateCcw, Upload, Download, Plus, Edit2, Trash2, Building2, AlertCircle, HelpCircle, Info } from 'lucide-react';
import {
  obtenerContactos,
  crearContacto,
  actualizarContacto,
  eliminarContacto,
  eliminarContactosBulk,
  syncContactosSheets,
  checkSyncStatus,
  buscarEmpresasApi
} from '../services/api';
import type { ContactoConRubro, CrearContactoInput } from '../types/contacto';
import { RUBROS_LABELS, RUBROS_LIST } from '../data/rubros';
import { usePermisos } from '../hooks/usePermisos';
import { useNotificationStore } from '../stores/useNotificationStore';
import AlertMessage from './ui/AlertMessage';
import ImportadorVisual from './ImportadorVisual';
import Modal from './ui/Modal';
import ConfirmModal from './ui/ConfirmModal';
import TablePagination from './ui/TablePagination';
import Spinner from './ui/Spinner';
import CustomSelect from './ui/CustomSelect';

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

  const rubroFilterOptions = useMemo(() => [
    { value: '', label: 'Todos los rubros' },
    { value: '__sin_rubro__', label: 'Sin Rubro' },
    ...RUBROS_LIST.map((r) => ({ value: r, label: RUBROS_LABELS[r] || r })),
  ], []);

  const estadoFilterOptions = useMemo(() => [
    { value: '', label: 'Todos los estados' },
    { value: 'funcional', label: 'Funcional' },
    { value: 'inactivo', label: 'Inactivo' },
    { value: 'rebotado inexistente', label: 'Rebotado Inexistente' },
    { value: 'rebotado bandeja llena', label: 'Rebotado Bandeja Llena' },
    { value: 'rebotado spam', label: 'Rebotado SPAM' },
    { value: 'rebotado desconocido', label: 'Rebotado Desconocido' },
    { value: 'mal_escrito', label: 'Mail Mal Escrito' },
  ], []);

  const modalEstadoOptions = useMemo(() => [
    { value: 'funcional', label: 'Funcional' },
    { value: 'inactivo', label: 'Inactivo' },
    { value: 'rebotado inexistente', label: 'Rebotado Inexistente' },
    { value: 'rebotado bandeja llena', label: 'Rebotado Bandeja Llena' },
    { value: 'rebotado spam', label: 'Rebotado SPAM' },
    { value: 'rebotado desconocido', label: 'Rebotado Desconocido' },
    { value: 'mal_escrito', label: 'Mail Mal Escrito' },
  ], []);

  const modalTipoOptions = useMemo(() => [
    { value: '', label: 'Sin tipo asignado' },
    { value: 'principal', label: 'Principal' },
    { value: 'secundario', label: 'Secundario' },
  ], []);

  const modalRubroOptions = useMemo(() => [
    { value: '', label: 'Sin rubro asignado' },
    ...RUBROS_LIST.map((r) => ({ value: r, label: RUBROS_LABELS[r] || r })),
  ], []);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
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
  const [exportError, setExportError] = useState<string | null>(null);

  // Autocompletado empresa
  const [empresasSugeridas, setEmpresasSugeridas] = useState<Array<{ id: string; nombre: string; cuit: string | null; rubro_id?: string | null }>>([]);
  const [showEmpresaSugeridas, setShowEmpresaSugeridas] = useState<false | 'empresa' | 'cuit'>(false);

  const buscarEmpresasSugeridas = async (q: string, fieldType: 'empresa' | 'cuit') => {
    if (!q || q.length < 2) { 
      setEmpresasSugeridas([]); 
      setShowEmpresaSugeridas(false); 
      return; 
    }
    try {
      const res = await buscarEmpresasApi(q);
      if (res.success && res.data) { 
        setEmpresasSugeridas(res.data); 
        setShowEmpresaSugeridas(res.data.length > 0 ? fieldType : false); 
      } else {
        setEmpresasSugeridas([]);
      }
    } catch { 
      setEmpresasSugeridas([]); 
    }
  };

  // Confirm Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sync Sheets
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Bloqueo de scroll en el body mientras cualquier modal esté abierto
  const isAnyModalOpen = isModalOpen || isImportModalOpen || !!deleteConfirmId || bulkDeleteConfirm || showHelp;
  useEffect(() => {
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isAnyModalOpen]);

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

  const handleExportCsv = async () => {
    setExportError(null);
    try {
      const res = await obtenerContactos({
        limit: 999999
      });

      if (!res.success || !res.data) {
        setExportError('Error al obtener datos para exportar');
        return;
      }

      const allContacts = res.data.data; // res.data es ContactosResponse
      const header = ['Empresa', 'Email', 'CUIT', 'Rubro', 'Estado', 'Tipo', 'Creado'];
      const rows = allContacts.map(c => [
        c.empresa_nombre || '',
        c.email,
        c.cuit || '',
        c.rubro_nombre ? (RUBROS_LABELS[c.rubro_nombre.trim().toLowerCase()] || c.rubro_nombre) : '',
        c.estado,
        c.tipo || '',
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
    } catch (e) {
      console.error(e);
      setExportError('Ocurrió un error al exportar el CSV');
    }
  };

  const handleSyncSheets = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncContactosSheets();
      if (!res.success) {
        // Si ya hay una sincronización en marcha, no es un error que deba alertar; mantenemos la UI en progreso
        if (res.error?.code === 'CONFLICT' || res.error?.message?.toLowerCase().includes('en curso')) {
          return;
        }
        // Si se excedió el límite de clics seguidos
        if (res.error?.code === 'SYNC_RATE_LIMIT' || res.error?.code === 'RATE_LIMIT_EXCEEDED') {
          setSyncResult({ success: false, message: 'La sincronización ya fue solicitada hace instantes. Continúa en segundo plano.' });
          return;
        }
        setSyncResult({ success: false, message: res.error?.message || 'Error al iniciar sincronización' });
        setIsSyncing(false);
      }
      // Si fue exitosa, el polling tomará el relevo para mostrar el estado final
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

    // Consultar estado inmediatamente al montar el componente
    checkStatus();

    // Polling cada 5 segundos únicamente mientras haya una sincronización activa
    if (isSyncing) {
      interval = setInterval(checkStatus, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSyncing]);

  // Actualización instantánea en vivo cuando llega evento SSE
  const ultimaNotificacion = useNotificationStore((state) => state.historial[0]);
  useEffect(() => {
    if (!ultimaNotificacion) return;
    if (ultimaNotificacion.tipo === 'sync_started') {
      setIsSyncing(true);
    } else if (ultimaNotificacion.tipo === 'sync_finished') {
      setIsSyncing(false);
      setSyncResult({
        success: Boolean(ultimaNotificacion.detalles?.exito ?? true),
        message: ultimaNotificacion.mensaje,
      });
      fetchContactosData(1);
      setPage(1);
    }
  }, [ultimaNotificacion]);


  const openCrearModal = () => {
    setEditingId(null);
    setForm({ email: '', empresa_nombre: '', cuit: '', rubro_id: '', estado: 'funcional', tipo: '' });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditarModal = (c: ContactoConRubro) => {
    setEditingId(c.id);
    const rubroKey = c.rubro_nombre?.trim().toLowerCase() || c.rubro_id?.trim().toLowerCase() || '';
    const rubroSeleccionado = RUBROS_LIST.includes(rubroKey) ? rubroKey : (c.rubro_id || '');

    setForm({
      email: c.email,
      empresa_nombre: c.empresa_nombre || '',
      cuit: c.cuit || '',
      rubro_id: rubroSeleccionado,
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

    const cuitLimpio = form.cuit ? form.cuit.trim() : '';

    if (cuitLimpio) {
      if (cuitLimpio.length !== 11) {
        setErrorMsg('El CUIT debe tener exactamente 11 dígitos, o déjalo vacío si no posee CUIT.');
        setSaving(false);
        return;
      }
      
      const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
      let total = 0;
      for (let i = 0; i < 10; i++) total += parseInt(cuitLimpio[i]) * multipliers[i];
      const mod = total % 11;
      let checkDigit = mod === 0 ? 0 : 11 - mod;
      if (checkDigit === 10) {
        const prefix = cuitLimpio.substring(0, 2);
        checkDigit = (prefix === '20' || prefix === '23' || prefix === '24') ? 9 : (prefix === '27' ? 4 : 9);
      }
      if (checkDigit !== parseInt(cuitLimpio[10])) {
        setErrorMsg('El CUIT ingresado no es matemáticamente válido.');
        setSaving(false);
        return;
      }
    }

    try {
      const payload: any = { ...form };
      payload.cuit = cuitLimpio || null;
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
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center justify-center gap-2 bg-surface text-dark border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors font-medium shadow-sm w-full sm:w-auto"
            title="Ayuda sobre el directorio"
          >
            <HelpCircle size={20} className="text-primary" />
          </button>
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

      <Modal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        maxWidth="lg"
        title={
          <span className="flex items-center gap-2">
            <Info size={20} className="text-primary" />
            ¿Cómo organizar tu base?
          </span>
        }
      >
        <div className="space-y-3.5 text-sm text-dark">
          <div className="bg-background p-3 rounded-lg border border-border">
            <h4 className="font-semibold text-primary mb-1">🔄 Sincronizar Sheets</h4>
            <p className="text-muted leading-relaxed">
              Importa nuevos contactos desde el Excel en la nube de Google Sheets (Automático y manual).
            </p>
          </div>

          <div className="bg-background p-3 rounded-lg border border-border">
            <h4 className="font-semibold text-primary mb-1">📤 Exportar/Importar CSV</h4>
            <p className="text-muted leading-relaxed">
              Sirve para hacer respaldos masivos o migraciones a otros sistemas de forma rápida.
            </p>
          </div>

          <div className="bg-background p-3 rounded-lg border border-border">
            <h4 className="font-semibold text-primary mb-1">🛡️ Estados (Rebotes)</h4>
            <p className="text-muted leading-relaxed">
              Los correos que no existan o reboten pasarán a estado "Rebotado" automáticamente por el sistema, lo que evita que se les envíe en la próxima campaña cuidando la reputación de tu cuenta.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowHelp(false)}
          className="mt-6 w-full px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors cursor-pointer"
        >
          Entendido
        </button>
      </Modal>

      {syncResult && (
        <div className="mb-6">
          <AlertMessage
            type={syncResult.success ? "success" : "error"}
            message={syncResult.message}
            onClose={() => setSyncResult(null)}
          />
        </div>
      )}

      {exportError && (
        <div className="mb-6">
          <AlertMessage
            type="error"
            message={exportError}
            onClose={() => setExportError(null)}
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
          <div className="w-full lg:w-[220px]">
            <label className="block text-sm font-semibold text-muted mb-1.5">Rubro</label>
            <CustomSelect
              value={rubroId}
              onChange={setRubroId}
              options={rubroFilterOptions}
              size="md"
            />
          </div>
          <div className="w-full lg:w-[220px]">
            <label className="block text-sm font-semibold text-muted mb-1.5">Estado</label>
            <CustomSelect
              value={estado}
              onChange={setEstado}
              options={estadoFilterOptions}
              size="md"
            />
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
                      <Spinner size="md" color="primary" className="mb-3" />
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
                    c.estado === 'funcional' ? 'bg-[#10b981] text-white' : // Verde (Activos)
                    c.estado === 'rebotado inexistente' ? 'bg-[#ef4444] text-white' : // Rojo
                    c.estado === 'rebotado bandeja llena' ? 'bg-[#f97316] text-white' : // Naranja
                    c.estado === 'rebotado spam' ? 'bg-[#854d0e] text-white' : // Marrón
                    c.estado === 'rebotado desconocido' ? 'bg-[#8b5cf6] text-white' : // Violeta
                    c.estado === 'mal_escrito' ? 'bg-pink-600 text-white' : // Rosa fuerte
                    c.estado === 'inactivo' ? 'bg-[#64748b] text-white' : // Gris
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
                      <td className="px-6 py-4 max-w-[170px] truncate" title={(c.rubro_nombre && (RUBROS_LABELS[c.rubro_nombre.trim().toLowerCase()] || c.rubro_nombre)) || 'Sin rubro'}>
                        <span className={`px-2.5 py-1 rounded-md text-xs inline-block ${c.rubro_nombre ? 'bg-background border border-border text-dark font-medium shadow-xs' : 'text-muted italic'}`}>
                          {c.rubro_nombre ? (RUBROS_LABELS[c.rubro_nombre.trim().toLowerCase()] || c.rubro_nombre) : 'Sin rubro'}
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
        <TablePagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />

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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="lg"
        title={editingId ? 'Editar Contacto' : 'Nuevo Contacto'}
        bodyClassName="p-0"
      >
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
                      buscarEmpresasSugeridas(e.target.value, 'empresa');
                    }}
                    onBlur={() => setTimeout(() => setShowEmpresaSugeridas(false), 150)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                    placeholder="Nombre de la empresa (busca entre existentes)"
                  />
                  {showEmpresaSugeridas === 'empresa' && empresasSugeridas.length > 0 && (
                    <ul className="absolute z-50 w-full bg-surface border border-border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {empresasSugeridas.map(emp => (
                        <li
                          key={emp.id}
                          className="px-3 py-2 hover:bg-primary/10 cursor-pointer text-dark flex justify-between items-center"
                          onMouseDown={() => {
                            setForm(f => ({ ...f, empresa_nombre: emp.nombre, cuit: emp.cuit || f.cuit, rubro_id: emp.rubro_id || f.rubro_id }));
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

                {/* CUIT - full width con autocompletado y opción Sin CUIT */}
                <div className="sm:col-span-2" style={{ position: 'relative' }}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-dark">
                      CUIT <span className="text-muted font-normal text-xs">(Opcional)</span>
                    </label>
                    {form.cuit && form.cuit.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, cuit: '' }))}
                        className="text-xs text-primary hover:text-primary-dark font-medium hover:underline transition-colors"
                      >
                        Dejar sin CUIT
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    autoComplete="off"
                    inputMode="numeric"
                    value={form.cuit || ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setForm({ ...form, cuit: val });
                      buscarEmpresasSugeridas(val, 'cuit');
                    }}
                    onBlur={() => setTimeout(() => setShowEmpresaSugeridas(false), 150)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                    placeholder="Sin guiones (ej: 30709328995) o dejar vacío"
                    maxLength={11}
                  />
                  {showEmpresaSugeridas === 'cuit' && empresasSugeridas.length > 0 && (
                    <ul className="absolute z-50 w-full bg-surface border border-border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {empresasSugeridas.map(emp => (
                        <li
                          key={emp.id}
                          className="px-3 py-2 hover:bg-primary/10 cursor-pointer text-dark flex justify-between items-center"
                          onMouseDown={() => {
                            setForm(f => ({ ...f, empresa_nombre: emp.nombre, cuit: emp.cuit || f.cuit, rubro_id: emp.rubro_id || f.rubro_id }));
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

                {/* Estado y Tipo - lado a lado */}
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Estado</label>
                  <CustomSelect
                    value={form.estado}
                    onChange={(val) => setForm({ ...form, estado: val as any })}
                    options={modalEstadoOptions}
                    size="md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Tipo de Contacto</label>
                  <CustomSelect
                    value={form.tipo || ''}
                    onChange={(val) => setForm({ ...form, tipo: val })}
                    options={modalTipoOptions}
                    size="md"
                  />
                </div>

                {/* Rubro - full width */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-dark mb-1">Rubro</label>
                  <CustomSelect
                    value={form.rubro_id || ''}
                    onChange={(val) => setForm({ ...form, rubro_id: val })}
                    options={modalRubroOptions}
                    size="md"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border bg-background text-dark rounded-lg hover:bg-surface font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium transition-colors disabled:opacity-70 flex items-center gap-2 cursor-pointer"
                >
                  {saving && <Spinner size="sm" color="white" />}
                  {editingId ? 'Guardar Cambios' : 'Crear Contacto'}
                </button>
              </div>
            </form>
      </Modal>

      {isImportModalOpen && (
        <ImportadorVisual
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={() => { setIsImportModalOpen(false); setPage(1); fetchContactosData(1); }}
        />
      )}

      {/* Modal de Confirmación de Eliminación */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmEliminar}
        title="¿Eliminar contacto?"
        description="Esta acción no se puede deshacer. Se borrarán los datos del directorio."
        confirmText="Sí, Eliminar"
        variant="danger"
        maxWidth="sm"
      />

      {/* Modal de Confirmación de Eliminación Masiva */}
      <ConfirmModal
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        isLoading={bulkDeleting}
        title={`¿Eliminar ${selectedIds.length} contacto${selectedIds.length > 1 ? 's' : ''}?`}
        description={`Esta acción no se puede deshacer. Se borrarán los datos de ${selectedIds.length} contacto${selectedIds.length > 1 ? 's' : ''} del directorio.`}
        confirmText="Sí, Eliminar Todos"
        variant="danger"
        maxWidth="sm"
      />
    </div>
  );
}

