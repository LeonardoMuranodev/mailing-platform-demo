import React, { useEffect, useState } from 'react';
import { Search, RotateCcw, Plus, Edit2, Trash2, X, Users, AlertCircle, Eye, EyeOff } from 'lucide-react';
import {
  obtenerUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
} from '../services/api';
import AlertMessage from './ui/AlertMessage';
import type { AuthUser } from '../types/auth';

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'invitado',
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Confirm Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState('');

  const fetchUsuariosData = async () => {
    setLoading(true);
    try {
      const res = await obtenerUsuarios();
      if (res.success && res.data) {
        setUsuarios(res.data);
      } else {
        setUsuarios([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuariosData();
  }, []);

  const filteredUsuarios = usuarios.filter((u) => {
    const matchSearch = (u.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                         u.email.toLowerCase().includes(busqueda.toLowerCase()));
    const matchRol = filtroRol ? u.rol === filtroRol : true;
    return matchSearch && matchRol;
  });

  const handleResetFilters = () => {
    setBusqueda('');
    setFiltroRol('');
  };

  const openCrearModal = () => {
    setEditingId(null);
    setForm({ nombre: '', email: '', password: '', rol: 'invitado' });
    setErrorMsg('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditarModal = (user: AuthUser) => {
    setEditingId(user.id);
    setForm({
      nombre: user.nombre,
      email: user.email,
      password: '',
      rol: user.rol,
    });
    setErrorMsg('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    
    try {
      const payload = { ...form };
      if (editingId) {
        const res = await actualizarUsuario(editingId, payload);
        if (res.success && res.data) {
          fetchUsuariosData();
          setIsModalOpen(false);
        } else {
          let msg = res.error?.message || 'Error al actualizar';
          if (res.error?.details && Array.isArray(res.error.details)) {
            msg += ': ' + res.error.details.map((d: any) => d.message).join(', ');
          }
          setErrorMsg(msg);
        }
      } else {
        const res = await crearUsuario(payload);
        if (res.success && res.data) {
          fetchUsuariosData();
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
    const res = await eliminarUsuario(deleteConfirmId);
    if (res.success) {
      fetchUsuariosData();
      setDeleteConfirmId(null);
      setDeleteErrorMsg('');
    } else {
      setDeleteErrorMsg(res.error?.message || 'Error al eliminar');
    }
  };

  const total = usuarios.length;
  const adminCount = usuarios.filter(u => u.rol === 'desarrollador').length;
  const encargadaCount = usuarios.filter(u => u.rol === 'encargada').length;
  const invitadoCount = usuarios.filter(u => u.rol === 'invitado').length;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 pr-4 sm:pr-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Users className="w-7 h-7" />
            Gestión de Usuarios
          </h1>
          <p className="text-muted mt-1 text-sm">
            Administrá las cuentas de la plataforma y asigná roles.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button
            onClick={openCrearModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors font-medium shadow-sm w-full sm:w-auto"
          >
            <Plus size={18} />
            Crear Usuario
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-muted font-medium">Total Usuarios</p>
            <h3 className="text-2xl font-bold text-dark">{total}</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Users size={20} />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex items-center justify-between opacity-90">
          <div>
            <p className="text-sm text-muted font-medium">Desarrolladores</p>
            <h3 className="text-2xl font-bold text-dark">{adminCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Users size={20} />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex items-center justify-between opacity-90">
          <div>
            <p className="text-sm text-muted font-medium">Encargadas</p>
            <h3 className="text-2xl font-bold text-dark">{encargadaCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-500">
            <Users size={20} />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex items-center justify-between opacity-90">
          <div>
            <p className="text-sm text-muted font-medium">Invitados</p>
            <h3 className="text-2xl font-bold text-dark">{invitadoCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-500/10 flex items-center justify-center text-gray-500">
            <Users size={20} />
          </div>
        </div>
      </div>

      <div className="bg-surface p-4 rounded-xl shadow-sm border border-border mb-6 transition-colors">
        <div className="flex flex-col lg:flex-row gap-4 items-end w-full">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-muted mb-1.5">Buscar Usuario</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o email..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors h-[42px]"
              />
            </div>
          </div>
          <div className="w-full lg:w-[200px]">
            <label className="block text-sm font-semibold text-muted mb-1.5">Rol</label>
            <select
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors h-[42px]"
            >
              <option value="">Todos los roles</option>
              <option value="desarrollador">Desarrollador</option>
              <option value="encargada">Encargada</option>
              <option value="invitado">Invitado</option>
            </select>
          </div>
          <div className="flex flex-row gap-3 w-full lg:w-auto">
            <button onClick={handleResetFilters} type="button" className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-background border border-border text-dark hover:bg-surface font-medium rounded-lg transition-colors shadow-sm text-sm h-[42px] whitespace-nowrap">
              <RotateCcw size={18} />
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted">
            <thead className="bg-background text-dark text-xs uppercase font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-4">Nombre</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted">
                    <div className="animate-pulse flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3"></div>
                      Cargando usuarios...
                    </div>
                  </td>
                </tr>
              ) : filteredUsuarios.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted">
                    No se encontraron usuarios.
                  </td>
                </tr>
              ) : (
                filteredUsuarios.map((u) => {
                  const rolBadge = 
                    u.rol === 'desarrollador' ? 'bg-indigo-500 text-white' :
                    u.rol === 'encargada' ? 'bg-teal-500 text-white' :
                    'bg-gray-500 text-white';

                  return (
                    <tr key={u.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-dark max-w-[200px] truncate" title={u.nombre}>
                        {u.nombre}
                      </td>
                      <td className="px-6 py-4 text-dark max-w-[200px] truncate" title={u.email}>
                        {u.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-md shadow-sm uppercase ${rolBadge}`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => openEditarModal(u)}
                            className="p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                            title="Editar usuario"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmId(u.id)}
                            className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                            title="Eliminar usuario"
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
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-lg rounded-xl border border-border shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold text-dark">{editingId ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-dark">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleGuardar} className="p-6 space-y-4" noValidate>
              <AlertMessage type="error" message={errorMsg} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-dark mb-1">Nombre Completo <span className="text-danger">*</span></label>
                  <input 
                    type="text" 
                    value={form.nombre}
                    onChange={e => setForm({...form, nombre: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                    placeholder="Juan Pérez"
                    required
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-dark mb-1">Email <span className="text-danger">*</span></label>
                  <input 
                    type="email" 
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                    placeholder="ejemplo@3f.com"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-dark mb-1">
                    Contraseña {editingId ? '(Dejar en blanco para no cambiar)' : <span className="text-danger">*</span>}
                  </label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={form.password}
                      onChange={e => setForm({...form, password: e.target.value})}
                      className="w-full pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                      placeholder="••••••••"
                      required={!editingId}
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-dark transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-dark mb-1">Rol</label>
                  <select
                    value={form.rol}
                    onChange={e => setForm({...form, rol: e.target.value as any})}
                    className="w-full pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 h-[42px]"
                  >
                    <option value="desarrollador">Desarrollador</option>
                    <option value="encargada">Encargada</option>
                    <option value="invitado">Invitado</option>
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
                  {editingId ? 'Guardar Cambios' : 'Crear Usuario'}
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
              <AlertCircle className="h-6 w-6 text-danger" />
            </div>
            <h3 className="text-lg font-semibold text-dark mb-2">¿Eliminar usuario?</h3>
            <p className="text-sm text-muted mb-6">
              Esta acción no se puede deshacer. El usuario perderá acceso al sistema permanentemente.
            </p>
            {deleteErrorMsg && (
              <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                {deleteErrorMsg}
              </div>
            )}
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteErrorMsg('');
                }}
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
