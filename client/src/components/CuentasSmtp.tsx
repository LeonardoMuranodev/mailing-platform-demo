import React, { useEffect, useState } from 'react';
import { Mail, Settings, Plus, Edit2, Trash2, Eye, EyeOff, Server } from 'lucide-react';
import {
  obtenerCuentasSmtp,
  crearCuentaSmtp,
  actualizarCuentaSmtp,
  eliminarCuentaSmtp,
  toggleEstadoSmtp,
} from '../services/api';
import type { CuentaSmtp } from '../types/smtp';
import AlertMessage from './ui/AlertMessage';

export default function CuentasSmtp() {
  const [cuentas, setCuentas] = useState<CuentaSmtp[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de Crear/Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    password_encrypted: '',
    limite_diario: 400,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modal de Confirmación de Eliminación
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchCuentas = async () => {
    setLoading(true);
    try {
      const res = await obtenerCuentasSmtp();
      if (res.success && res.data) {
        setCuentas(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCuentas();
  }, []);

  const handleToggleEstado = async (cuenta: CuentaSmtp) => {
    const nuevoEstado = cuenta.estado === 'activo' ? 'inactivo' : 'activo';
    // Optimistic UI update
    setCuentas(prev => prev.map(c => c.id === cuenta.id ? { ...c, estado: nuevoEstado } : c));
    const res = await toggleEstadoSmtp(cuenta.id, nuevoEstado);
    if (!res.success) {
      // Revert if failed
      setCuentas(prev => prev.map(c => c.id === cuenta.id ? { ...c, estado: cuenta.estado } : c));
      alert('Error al cambiar el estado de la cuenta');
    }
  };

  const confirmEliminar = async () => {
    if (!deleteConfirmId) return;
    const res = await eliminarCuentaSmtp(deleteConfirmId);
    if (res.success) {
      setCuentas(prev => prev.filter(c => c.id !== deleteConfirmId));
    } else {
      alert(res.error?.message || 'Error al eliminar');
    }
    setDeleteConfirmId(null);
  };

  const openCrearModal = () => {
    setEditingId(null);
    setForm({ email: '', password_encrypted: '', limite_diario: 400 });
    setErrorMsg('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditarModal = (cuenta: CuentaSmtp) => {
    setEditingId(cuenta.id);
    setForm({
      email: cuenta.email,
      password_encrypted: '', // Dejar vacío para no mostrar ********
      limite_diario: cuenta.limite_diario,
    });
    setErrorMsg('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    
    const displayError = (res: any, defaultMsg: string) => {
      if (res.error?.details && res.error.details.length > 0) {
        setErrorMsg(res.error.details.map((d: any) => d.message).join('. '));
      } else {
        setErrorMsg(res.error?.message || defaultMsg);
      }
    };

    try {
      if (editingId) {
        const payload: any = {
          email: form.email,
          limite_diario: form.limite_diario,
        };
        if (form.password_encrypted) {
          payload.password_encrypted = form.password_encrypted;
        }
        const res = await actualizarCuentaSmtp(editingId, payload);
        if (res.success && res.data) {
          setCuentas(prev => prev.map(c => c.id === editingId ? res.data! : c));
          setIsModalOpen(false);
        } else {
          displayError(res, 'Error al actualizar');
        }
      } else {
        const res = await crearCuentaSmtp({
          usuario: form.email,
          email: form.email,
          password_encrypted: form.password_encrypted,
          limite_diario: form.limite_diario,
        });
        if (res.success && res.data) {
          setCuentas([res.data, ...cuentas]);
          setIsModalOpen(false);
        } else {
          displayError(res, 'Error al crear');
        }
      }
    } catch (e) {
      setErrorMsg('Error de red al conectar con el servidor.');
    } finally {
      setSaving(false);
    }
  };

  const capTotal = cuentas.filter(c => c.estado === 'activo').reduce((acc, curr) => acc + curr.limite_diario, 0);
  const usoTotal = cuentas.filter(c => c.estado === 'activo').reduce((acc, curr) => acc + curr.enviados_hoy, 0);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            Cuentas SMTP y Capacidad de Envío
          </h1>
          <p className="text-muted mt-1 text-sm flex items-center gap-2">
            <Server size={16} />
            Capacidad Global Diaria:{' '}
            <span className="font-semibold text-dark">{usoTotal.toLocaleString()} / {capTotal.toLocaleString()}</span> correos disponibles hoy
          </p>
        </div>
        <button
          onClick={openCrearModal}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm"
        >
          <Plus size={18} />
          Conectar Cuenta Gmail
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3"></div>
            Cargando cuentas...
          </div>
        </div>
      ) : cuentas.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-muted">
          <Settings size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-dark">No hay cuentas configuradas</p>
          <p className="text-sm mt-1">Conecta una cuenta de Gmail para comenzar a enviar correos masivos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cuentas.map(cuenta => {
            const usoPct = (cuenta.enviados_hoy / cuenta.limite_diario) * 100;
            const isActivo = cuenta.estado === 'activo';
            const isAgotado = cuenta.estado === 'agotado';
            const isActiveOrExhausted = isActivo || isAgotado;

            return (
              <div key={cuenta.id} className="bg-surface rounded-xl border border-border shadow-sm p-5 relative group overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-500/10 p-2.5 rounded-lg text-red-600 dark:text-red-400">
                      <Mail size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-dark truncate max-w-[180px]" title={cuenta.email}>{cuenta.email}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1 text-white shadow-sm
                          ${isActivo ? 'bg-success' : 
                            isAgotado ? 'bg-warning' : 
                            'bg-gray-500'}`}>
                          {cuenta.estado.charAt(0).toUpperCase() + cuenta.estado.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Toggle Activo/Inactivo */}
                  <button 
                    onClick={() => handleToggleEstado(cuenta)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background
                      ${isActivo ? 'bg-success' : 'bg-gray-400 dark:bg-gray-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActivo ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between text-sm mb-1.5 font-medium">
                    <span className="text-muted">Uso Diario</span>
                    <span className={isActiveOrExhausted ? 'text-dark' : 'text-muted'}>
                      {cuenta.enviados_hoy} / {cuenta.limite_diario}
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2 overflow-hidden border border-border/50">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${isAgotado || usoPct > 90 ? 'bg-danger' : usoPct > 70 ? 'bg-warning' : 'bg-primary'}`} 
                      style={{ width: `${Math.min(usoPct, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <div className="text-xs text-muted">
                    Histórico: <span className="font-medium text-dark">{cuenta.historial_despachado?.toLocaleString() || 0} envíos</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => openEditarModal(cuenta)}
                      className="p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                      title="Editar cuenta"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirmId(cuenta.id)}
                      className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                      title="Eliminar cuenta"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold text-dark">{editingId ? 'Editar Cuenta SMTP' : 'Conectar Cuenta Gmail'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-dark">✕</button>
            </div>
            
            <form onSubmit={handleGuardar} className="p-6 space-y-4" noValidate>
              <AlertMessage type="error" message={errorMsg} />

              <div>
                <label className="block text-sm font-medium text-dark mb-1">Correo Electrónico (Gmail)</label>
                <input 
                  type="text" 
                  value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="ejemplo@gmail.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-1">Contraseña de Aplicación</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={form.password_encrypted}
                    onChange={e => setForm({...form, password_encrypted: e.target.value})}
                    className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder={editingId ? "Dejar como está para no cambiar" : "Contraseña de 16 caracteres"}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted hover:text-dark"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-muted mt-1.5">No es la clave de tu cuenta, sino la <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-primary hover:underline">Contraseña de Aplicación generada en Google</a> (16 letras).</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-1">Límite Diario de Envíos</label>
                <input 
                  type="text" 
                  value={form.limite_diario}
                  onChange={e => setForm({...form, limite_diario: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-muted mt-1.5">Google permite máximo 500 al día. Recomendamos 400 por seguridad.</p>
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
                  {editingId ? 'Guardar Cambios' : 'Conectar Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm p-6 animate-fade-in border border-border text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-danger/10 mb-4">
              <Trash2 className="h-6 w-6 text-danger" />
            </div>
            <h3 className="text-lg font-semibold text-dark mb-2">¿Eliminar cuenta?</h3>
            <p className="text-sm text-muted mb-6">
              Esta acción no se puede deshacer. Esto no afectará el historial de envíos ya procesados.
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
    </div>
  );
}
