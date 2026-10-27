import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, CalendarX, Plus, Trash2, CalendarDays, HelpCircle, X, Info } from 'lucide-react';
import {
  obtenerHorariosSmtp,
  actualizarHorariosSmtp,
  agregarFechaExcluida,
  eliminarFechaExcluida
} from '../services/api';
import AlertMessage from './ui/AlertMessage';
import { usePermisos } from '../hooks/usePermisos';

export default function HorariosSmtp() {
  const { esDesarrollador, esEncargada } = usePermisos();
  const puedeVer = esDesarrollador || esEncargada;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Bloqueo de scroll en el body mientras el modal de ayuda esté abierto
  useEffect(() => {
    if (showHelp) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showHelp]);
  
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFin, setHoraFin] = useState('18:00');
  const [diasPermitidos, setDiasPermitidos] = useState<number[]>([1, 2, 3, 4, 5]);
  const [fechasExcluidas, setFechasExcluidas] = useState<any[]>([]);
  
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevoMotivo, setNuevoMotivo] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchHorarios = async () => {
    try {
      const res = await obtenerHorariosSmtp();
      if (res.success && res.data) {
        if (res.data.configuracion) {
          // PostgreSQL TIME comes as HH:MM:SS, we need HH:MM for input type="time"
          setHoraInicio(res.data.configuracion.hora_inicio.substring(0, 5));
          setHoraFin(res.data.configuracion.hora_fin.substring(0, 5));
          setDiasPermitidos(res.data.configuracion.dias_permitidos || []);
        }
        if (res.data.fechas_excluidas) {
          setFechasExcluidas(res.data.fechas_excluidas);
        }
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Error al cargar la configuración de horarios.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (puedeVer) fetchHorarios();
  }, [puedeVer]);

  if (!puedeVer) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
        <AlertMessage type="error" message="No tienes permisos para acceder a esta configuración." />
      </div>
    );
  }

  const handleSaveHorarios = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (diasPermitidos.length === 0) {
        setMessage({ type: 'error', text: 'Debes seleccionar al menos un día permitido.' });
        setSaving(false);
        return;
      }
      
      const res = await actualizarHorariosSmtp({
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        dias_permitidos: diasPermitidos
      });
      
      if (res.success) {
        setMessage({ type: 'success', text: 'Configuración de horarios guardada exitosamente.' });
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Error al guardar.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de red.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleDia = (diaId: number) => {
    setDiasPermitidos(prev => 
      prev.includes(diaId) 
        ? prev.filter(d => d !== diaId)
        : [...prev, diaId]
    );
  };

  const handleAgregarFeriado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaFecha) return;
    
    setSaving(true);
    try {
      const res = await agregarFechaExcluida({ fecha: nuevaFecha, motivo: nuevoMotivo });
      if (res.success) {
        setNuevaFecha('');
        setNuevoMotivo('');
        fetchHorarios();
        setMessage({ type: 'success', text: 'Día excluido agregado correctamente.' });
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Error al agregar fecha.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de red.' });
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarFeriado = async (id: string) => {
    try {
      const res = await eliminarFechaExcluida(id);
      if (res.success) {
        fetchHorarios();
        setMessage({ type: 'success', text: 'Día excluido eliminado.' });
      } else {
        setMessage({ type: 'error', text: res.error?.message || 'Error al eliminar.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error de red.' });
    }
  };

  const diasSemana = [
    { id: 1, label: 'Lunes' },
    { id: 2, label: 'Martes' },
    { id: 3, label: 'Miércoles' },
    { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' },
    { id: 6, label: 'Sábado' },
    { id: 7, label: 'Domingo' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 animate-fade-in">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Clock size={24} />
            Control de Horarios SMTP
          </h1>
          <p className="text-muted mt-1 text-sm">
            Define en qué días y en qué rango horario el sistema podrá procesar la cola de envíos.
          </p>
        </div>
        
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center justify-center gap-2 bg-surface text-dark border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors font-medium shadow-sm"
          title="Ayuda sobre el Worker"
        >
          <HelpCircle size={20} className="text-primary" />
        </button>
      </div>

      {showHelp && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg p-6 border border-border relative my-auto animate-slide-up max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 text-muted hover:text-dark transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
              <Info size={20} className="text-primary" />
              ¿Cómo funciona el envío automático (Worker)?
            </h3>
            
            <div className="space-y-3.5 text-sm text-dark">
              <p className="text-muted leading-relaxed">
                El sistema cuenta con un proceso automático inteligente que gestiona y reparte los envíos de todas las campañas sin requerir acción manual.
              </p>

              <div className="bg-background p-3 rounded-lg border border-border">
                <h4 className="font-semibold text-primary mb-1">⏱️ Activación cada 1 hora</h4>
                <p className="text-muted leading-relaxed">
                  Cada <strong>60 minutos</strong> el sistema se despierta, calcula cuántos correos están pendientes y distribuye una tanda segura de envíos entre las cuentas disponibles.
                </p>
              </div>

              <div className="bg-background p-3 rounded-lg border border-border">
                <h4 className="font-semibold text-primary mb-1">🎯 Prioridad por Fecha de Finalización</h4>
                <p className="text-muted leading-relaxed">
                  Si hay varias campañas en curso, el sistema <strong>le da prioridad a la campaña que termina antes</strong> (fecha de fin más próxima), garantizando que las comunicaciones más urgentes salgan primero.
                </p>
              </div>

              <div className="bg-background p-3 rounded-lg border border-border">
                <h4 className="font-semibold text-primary mb-1">📅 Respeto de Horarios y Feriados</h4>
                <p className="text-muted leading-relaxed">
                  Los correos solo se despachan en la <strong>franja horaria y días seleccionados aquí</strong>. Si llega una hora no laboral o un día feriado/excluido, el sistema pausa los envíos y los reanuda automáticamente apenas comience el próximo horario permitido.
                </p>
              </div>

              <div className="bg-background p-3 rounded-lg border border-border">
                <h4 className="font-semibold text-primary mb-1">🛡️ Cuidado de Casillas (Antispam)</h4>
                <p className="text-muted leading-relaxed">
                  No envía todo de golpe: dosifica los correos respetando las cuotas de cada cuenta para evitar que los mensajes caigan en correo no deseado (Spam).
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}

      {message && (
        <div className="mb-6">
          <AlertMessage 
            type={message.type} 
            message={message.text} 
            onClose={() => setMessage(null)} 
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lado izquierdo: Configuración General */}
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-bold text-dark flex items-center gap-2 mb-6">
                <Clock size={20} className="text-primary" />
                Rango Horario
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">Hora Fin</label>
                  <input
                    type="time"
                    value={horaFin}
                    onChange={(e) => setHoraFin(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <h2 className="text-lg font-bold text-dark flex items-center gap-2 mb-4">
                <CalendarDays size={20} className="text-primary" />
                Días de la Semana
              </h2>
              
              <div className="flex flex-wrap gap-2">
                {diasSemana.map(dia => {
                  const active = diasPermitidos.includes(dia.id);
                  return (
                    <button
                      key={dia.id}
                      onClick={() => toggleDia(dia.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        active 
                          ? 'bg-primary text-white shadow-sm' 
                          : 'bg-background border border-border text-muted hover:border-primary/50 hover:text-primary'
                      }`}
                    >
                      {dia.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 bg-background border-t border-border">
              <button
                onClick={handleSaveHorarios}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>
        </div>

        {/* Lado derecho: Fechas Excluidas */}
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-bold text-dark flex items-center gap-2 mb-6">
                <CalendarX size={20} className="text-danger" />
                Días No Laborales / Feriados
              </h2>

              <form onSubmit={handleAgregarFeriado} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mb-8 bg-background p-4 rounded-lg border border-border">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-dark mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={nuevaFecha}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="block text-xs font-medium text-dark mb-1">Motivo (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Navidad"
                    value={nuevoMotivo}
                    onChange={(e) => setNuevoMotivo(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving || !nuevaFecha}
                  className="px-4 py-2 bg-secondary text-white font-medium rounded-lg hover:bg-secondary-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm h-[38px] sm:w-auto"
                >
                  <Plus size={16} />
                  Agregar
                </button>
              </form>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {fechasExcluidas.length === 0 ? (
                  <p className="text-muted text-sm text-center py-4">No hay días excluidos configurados.</p>
                ) : (
                  fechasExcluidas.map((f: any) => {
                    const fechaObj = new Date(f.fecha);
                    // Adjust to local to prevent timezone shifting
                    fechaObj.setMinutes(fechaObj.getMinutes() + fechaObj.getTimezoneOffset());
                    
                    return (
                      <div key={f.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:border-danger/30 transition-colors">
                        <div>
                          <p className="font-bold text-dark">{fechaObj.toLocaleDateString()}</p>
                          <p className="text-xs text-muted mt-0.5">{f.motivo || 'Sin especificar'}</p>
                        </div>
                        <button
                          onClick={() => handleEliminarFeriado(f.id)}
                          className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
