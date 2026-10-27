import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Eye, EyeOff, Loader2, Save, KeyRound, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import HistorialTable from '../components/HistorialTable';
import type { HistorialItem } from '../components/HistorialTable';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('es');

export default function Perfil() {
  const { user, logout } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(true);

  useEffect(() => {
    fetchHistorial();
  }, []);

  const fetchHistorial = async () => {
    try {
      const response = await fetch('/api/historial/me', {
        headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` }
      });
      const data = await response.json();
      if (data.success) {
        setHistorial(data.data);
      }
    } catch (error) {
      console.error('Error al obtener historial:', error);
    } finally {
      setIsLoadingHistorial(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ text: 'Todos los campos son obligatorios', type: 'error' });
      return;
    }

    if (newPassword === currentPassword) {
      setMessage({ text: 'La nueva contraseña no puede ser igual a la actual', type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ text: 'Las contraseñas nuevas no coinciden', type: 'error' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ text: 'La nueva contraseña debe tener al menos 6 caracteres', type: 'error' });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${useAuthStore.getState().token}`
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Error al cambiar la contraseña');
      }

      setMessage({ text: 'Contraseña actualizada con éxito. Por favor inicia sesión nuevamente.', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        logout();
      }, 3000);
      
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Mi Perfil</h1>
          <p className="text-sm text-muted mt-1">Gestiona tu cuenta y revisa tu actividad.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lado izquierdo: Info y Cambio de Contraseña */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
            <h2 className="text-lg font-semibold text-dark mb-4">Información de Cuenta</h2>
            <div className="space-y-3">
              <div>
                <span className="block text-xs font-medium text-muted uppercase tracking-wider">Nombre</span>
                <span className="block text-dark font-medium">{user?.nombre}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-muted uppercase tracking-wider">Email</span>
                <span className="block text-dark font-medium">{user?.email}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-muted uppercase tracking-wider">Rol</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary uppercase">
                  {user?.rol}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-dark">Cambiar Contraseña</h2>
            </div>
            
            <form onSubmit={handlePasswordChange} className="space-y-4" noValidate>
              {message && (
                <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  {message.type === 'success' && <CheckCircle size={16} className="inline mr-2" />}
                  {message.type === 'error' && <AlertTriangle size={16} className="inline mr-2" />}
                  {message.text}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark mb-1">Contraseña Actual</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-dark"
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-dark mb-1">Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-dark"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-1">Confirmar Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 text-sm bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-dark"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Actualizar Contraseña
              </button>
            </form>
          </div>
        </div>

        {/* Lado derecho: Historial */}
        <div className="lg:col-span-2">
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden flex flex-col h-full min-h-[400px] max-h-[800px]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={20} className="text-primary" />
                <h2 className="text-lg font-semibold text-dark">Mi Actividad</h2>
              </div>
            </div>
            <div className="p-0 overflow-y-auto flex-1 bg-background/50">
              {isLoadingHistorial ? (
                <div className="flex flex-col items-center justify-center h-48">
                  <Loader2 className="animate-spin text-primary mb-2" size={32} />
                  <p className="text-muted text-sm">Cargando actividad...</p>
                </div>
              ) : historial.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted">
                  <p>No hay registros de actividad todavía.</p>
                </div>
              ) : (
                <div className="p-4">
                  <HistorialTable historial={historial} showActor={false} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
