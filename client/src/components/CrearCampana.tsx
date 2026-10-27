import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Mail, CheckCircle2, Save, Eye, ArrowLeft, Plus, List, FileText, HelpCircle, X, Info, ArrowUp, AlertTriangle } from 'lucide-react';
import { useCampanaStore, buildFormData } from '../stores/campanaStore';
import TiptapEditor from './TiptapEditor';
import FlyerUpload from './FlyerUpload';
import { RUBROS_LIST, RUBROS_LABELS } from '../data/rubros';
import AlertMessage from './ui/AlertMessage';
import { enviarMailPruebaCampana, obtenerCampanaPorId } from '../services/api';
import { useNotificationStore } from '../stores/useNotificationStore';

export default function CrearCampana() {
  const navigate = useNavigate();
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSinFlyerModal, setShowSinFlyerModal] = useState(false);
  const [conAdjunto, setConAdjunto] = useState(
    () => !!(useCampanaStore.getState().adjuntosNames.length > 0) || !!useCampanaStore.getState().form.adjuntos_extras?.length
  );
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Bloqueo de scroll en el body mientras cualquier modal esté abierto
  const submitSuccess = useCampanaStore((s) => s.submitResult?.success);
  const isAnyModalOpen = showHelp || showSinFlyerModal || Boolean(submitSuccess);
  useEffect(() => {
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isAnyModalOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  const {
    form,
    errors,
    setField,
    setHtmlContent,
    setAdjuntos,
    adjuntos,
    maxAdjuntos,
    cargarConfig,
    toggleRubro,
    guardarBorrador,
    aprobarCampana,
    isSubmitting,
    submitResult,
    clearResult,
    reset,
  } = useCampanaStore();

  // Limpiar mensajes: solo resetear si hay un submitResult exitoso previo
  // NO reseteamos si venimos de Vista Previa (el store tiene datos en uso)
  useEffect(() => {
    cargarConfig();
    const state = useCampanaStore.getState();
    if (state.submitResult?.success) {
      reset();
    } else {
      clearResult();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { id } = useParams<{ id: string }>();

  // Cargar borrador de localStorage o desde la API si estamos editando
  useEffect(() => {
    if (id) {
      // ── Modo edición: cargar datos de la campaña desde la API ──
      obtenerCampanaPorId(id).then(res => {
        if (res.success && res.data) {
          const campana = res.data;
          setField('asunto', campana.asunto);
          setHtmlContent(campana.cuerpo_html || '');
          
          if (campana.link_inscripcion) {
            setField('link_inscripcion', campana.link_inscripcion);
            setField('usa_links_multiples', false);
          } else if (campana.link_nacion || campana.link_provincia) {
            setField('usa_links_multiples', true);
            if (campana.link_nacion) setField('link_nacion', campana.link_nacion);
            if (campana.link_provincia) setField('link_provincia', campana.link_provincia);
          }
          
          if (campana.flyer_url) {
            setField('flyer_url', campana.flyer_url);
            useCampanaStore.setState({ flyerPreview: campana.flyer_url });
          }
          
          if (campana.adjunto_url || (campana.adjuntos_extras && campana.adjuntos_extras.length > 0)) {
            setConAdjunto(true);
            // Poblar adjuntos_extras en el form para que buildFormData los preserve
            if (campana.adjuntos_extras && campana.adjuntos_extras.length > 0) {
              setField('adjuntos_extras', campana.adjuntos_extras);
            } else if (campana.adjunto_url) {
              // Retrocompatibilidad: campaña vieja con adjunto_url solo
              const nombre = campana.adjunto_nombre_original || campana.adjunto_url.split('/').pop() || 'Adjunto';
              setField('adjuntos_extras', [{ url: campana.adjunto_url, nombre_original: nombre }]);
            }
          }
          
          if (campana.fecha_limite_envio) setField('fecha_limite_envio', campana.fecha_limite_envio.split('T')[0]);
          setField('prioridad', campana.prioridad);
          setField('para_todos_rubros', campana.para_todos_rubros);
          setField('rubros_seleccionados', campana.rubros_seleccionados);
        }
      }).catch(err => console.error('Error loading campaign:', err));
    } else {
      // ── Modo nueva campaña ──
      // Si el store ya tiene contenido (ej: volvemos de Vista Previa),
      // NO reseteamos para no perder el estado en memoria (flyer, adjunto, html).
      const currentState = useCampanaStore.getState();
      const storeHasContent = !!(currentState.form.asunto || currentState.form.cuerpo_html || currentState.flyerPreview);

      if (!storeHasContent) {
        // Primera carga real: limpiar y restaurar desde localStorage si hay borrador
        useCampanaStore.getState().reset();
        const savedDraft = localStorage.getItem('draft_campana_data');
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            Object.entries(parsed).forEach(([k, v]) => {
              // Evitamos cargar URLs de archivos porque son referencias del servidor,
              // no podemos reconstruir el File object ni la URL de objeto en memoria
              if (k !== 'flyer_url' && k !== 'flyer' && k !== 'adjunto_url' && k !== 'adjunto') {
                if (k === 'cuerpo_html') setHtmlContent(v as string);
                else setField(k as any, v);
              }
            });
          } catch (err) {
            console.error('Error parsing draft data', err);
          }
        }
      }
      // Si storeHasContent == true, el usuario acaba de volver de Vista Previa:
      // el store ya tiene todos los datos correctos, no hacemos nada.
    }
  }, [id, setField, setHtmlContent]);

  // Guardar en localStorage cada vez que cambie 'form' solo si no estamos editando
  useEffect(() => {
    if (!id) {
      localStorage.setItem('draft_campana_data', JSON.stringify(form));
    }
  }, [form, id]);

  const handleCrearOtra = () => {
    reset();
    navigate('/nueva');
  };

  const handleVerDetalle = () => {
    if (submitResult?.id) {
      const id = submitResult.id;
      reset();
      navigate(`/campanas/${id}`);
    }
  };

  const handleVerVistaPrevia = () => {
    navigate('/preview');
  };

  const handleIrACampanas = () => {
    reset();
    navigate('/');
  };

  const handleMandarPrueba = async () => {
    const { agregarNotificacion, pedirPermisoDesktop } = useNotificationStore.getState();

    // Solicitar permiso de notificaciones de escritorio si aún no se solicitó (mediante el click del usuario)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      pedirPermisoDesktop();
    }

    if (!form.asunto || !form.cuerpo_html) {
      agregarNotificacion({
        tipo: 'test_mail_error',
        titulo: 'Faltan datos para la prueba',
        mensaje: 'El asunto y el cuerpo del correo son requeridos para enviar la prueba.',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    setIsSendingTest(true);
    try {
      const fd = buildFormData(form, useCampanaStore.getState().flyer, useCampanaStore.getState().adjuntos);
      // Incluir flyer_url si existe pero no se subió archivo nuevo
      if (!useCampanaStore.getState().flyer && form.flyer_url) fd.append('flyer_url', form.flyer_url);
      // adjuntos_extras se maneja dentro de buildFormData automáticamente

      const res = await enviarMailPruebaCampana(fd);
      if (res.success) {
        const destinatario = res.data?.destinatario || '';
        const mensaje = res.data?.message || `Mail de prueba enviado exitosamente${destinatario ? ` a ${destinatario}` : ''}`;
        agregarNotificacion({
          tipo: 'test_mail_sent',
          titulo: 'Mail de Prueba Enviado',
          mensaje,
          timestamp: new Date().toISOString(),
        });
      } else {
        agregarNotificacion({
          tipo: 'test_mail_error',
          titulo: 'Error en Mail de Prueba',
          mensaje: res.error?.message || 'Error al enviar mail de prueba',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      agregarNotificacion({
        tipo: 'test_mail_error',
        titulo: 'Error de Red',
        mensaje: e.message || 'Error de conexión al enviar el mail de prueba',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Manejo de aprobación con advertencia de flyer opcional
  const handleIntentarAprobar = () => {
    const state = useCampanaStore.getState();
    const hasFlyer = !!(state.flyer || form.flyer_url || state.flyerPreview);
    if (!hasFlyer) {
      setShowSinFlyerModal(true);
    } else {
      aprobarCampana(id);
    }
  };

  const handleConfirmarAprobarSinFlyer = () => {
    setShowSinFlyerModal(false);
    aprobarCampana(id);
  };

  // Bloquear formulario si ya se envió exitosamente
  const isSubmittedSuccessfully = submitResult?.success === true;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted hover:text-dark font-medium transition-colors bg-surface px-4 py-2 rounded-lg border border-border shadow-sm mr-4"
        >
          <ArrowLeft size={18} />
          Volver
        </button>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Mail className="text-primary" />
            {id ? 'Editar Campaña' : 'Nueva Campaña de Correo'}
          </h1>
          <p className="text-muted mt-1">
            Completá los datos para armar el comunicado.
          </p>
        </div>
        
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center justify-center gap-2 bg-surface text-dark border border-border px-3 py-2 rounded-lg hover:bg-background transition-colors font-medium shadow-sm"
          title="Ayuda sobre la creación de campañas"
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
              ¿Cómo funciona esta sección?
            </h3>
            
            <div className="space-y-3.5 text-sm text-dark">
              <div className="bg-background p-3 rounded-lg border border-border">
                <h4 className="font-semibold text-primary mb-1">✍️ Maquetado</h4>
                <p className="text-muted leading-relaxed">
                  Redactá tu mensaje en el editor. Las imágenes y estilos que agregues se mantendrán tal cual en el correo final.
                </p>
              </div>

              <div className="bg-background p-3 rounded-lg border border-border">
                <h4 className="font-semibold text-primary mb-1">🖼️ Flyer Opcional</h4>
                <p className="text-muted leading-relaxed">
                  El flyer es una imagen visual destacada. Si tu comunicado no lo requiere, podés omitirlo y se enviará únicamente el texto formateado.
                </p>
              </div>

              <div className="bg-background p-3 rounded-lg border border-border">
                <h4 className="font-semibold text-primary mb-1">👀 Vista Previa</h4>
                <p className="text-muted leading-relaxed">
                  Antes de enviar o guardar, tocá en "Vista Previa" (abajo de todo) para ver exactamente cómo lo recibirá el destinatario en su celular o computadora.
                </p>
              </div>

              <div className="bg-background p-3 rounded-lg border border-border">
                <h4 className="font-semibold text-primary mb-1">📩 Mail de Prueba</h4>
                <p className="text-muted leading-relaxed">
                  Al enviar una prueba, te llegará un correo real a tu casilla para verificar que los links y adjuntos funcionen perfectamente.
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

      {/* ═══ MODAL DE ADVERTENCIA: SIN FLYER ═══ */}
      {showSinFlyerModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-surface w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden p-6 relative my-auto animate-slide-up">
            <button 
              onClick={() => setShowSinFlyerModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-dark transition-colors"
            >
              <X size={20} />
            </button>
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full badge-warning-light mb-4 shadow-sm">
                <AlertTriangle className="h-8 w-8" strokeWidth={2.3} />
              </div>
              <h3 className="text-lg font-bold text-dark mb-2">
                ¿Enviar campaña sin Flyer?
              </h3>
              <p className="text-muted text-sm leading-relaxed mb-6">
                No has adjuntado una imagen de flyer a esta campaña. Los destinatarios recibirán el comunicado únicamente con el texto redactado y los enlaces correspondientes.
                <br /><br />
                ¿Estás segura de continuar y aprobar la campaña sin flyer?
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setShowSinFlyerModal(false)}
                  className="flex-1 px-4 py-2.5 bg-background border border-border text-dark font-medium rounded-lg hover:bg-surface transition-colors order-2 sm:order-1"
                >
                  Volver a editar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarAprobarSinFlyer}
                  className="flex-1 px-4 py-2.5 bg-secondary text-white font-medium rounded-lg hover:bg-secondary-dark transition-colors order-1 sm:order-2 shadow-sm font-semibold"
                >
                  Continuar sin Flyer
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Error message (solo errores, no éxito) */}
      {submitResult && !submitResult.success && (
        <div className="mb-6" role="alert" aria-live="assertive">
          <AlertMessage
            type="error"
            message={
              Object.keys(errors).length > 0
                ? `Te faltó revisar: ${Object.keys(errors).map(k => ({
                    asunto: 'Asunto',
                    cuerpo_html: 'Cuerpo del mensaje',
                    link_inscripcion: 'Enlace de inscripción',
                    link_nacion: 'Link Nación',
                    link_provincia: 'Link Provincia',
                    fecha_limite_envio: 'Fecha límite de envío',
                    flyer: 'Flyer adjunto',
                    flyer_url: 'Flyer adjunto',
                    rubros_seleccionados: 'Rubros destinatarios',
                  }[k] || k)).join(', ')}.`
                : submitResult.message
            }
            onClose={clearResult}
          />
        </div>
      )}


      {/* ═══ MODAL DE ÉXITO ═══ */}
      {submitResult?.success && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-surface w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden my-auto animate-fade-in">
            <div className="p-6 sm:p-8 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-dark mb-2">
                {submitResult.mode === 'aprobada'
                  ? '¡Campaña Aprobada!'
                  : '¡Borrador Guardado!'}
              </h2>
              <p className="text-muted text-sm mb-6">
                {submitResult.message}
              </p>

              <div className="flex flex-col gap-3">
                {/* Opción condicional según modo */}
                {submitResult.mode === 'aprobada' && submitResult.id && (
                  <button
                    onClick={handleVerDetalle}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    <FileText size={18} />
                    Ver Detalle de la Campaña
                  </button>
                )}

                {submitResult.mode === 'borrador' && (
                  <button
                    onClick={handleVerVistaPrevia}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    <Eye size={18} />
                    Ver Vista Previa
                  </button>
                )}

                {/* Crear otra campaña */}
                <button
                  onClick={handleCrearOtra}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-white font-medium rounded-lg hover:bg-secondary-dark transition-colors"
                >
                  <Plus size={18} />
                  Crear Otra Campaña
                </button>

                {/* Ir a campañas */}
                <button
                  onClick={handleIrACampanas}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-background border border-border text-dark font-medium rounded-lg hover:bg-surface transition-colors"
                >
                  <List size={18} />
                  Ir a Campañas
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden transition-colors">
        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Asunto */}
          <div>
            <label htmlFor="asunto" className="block text-base font-semibold text-dark mb-1.5">
              Asunto del correo <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              id="asunto"
              value={form.asunto}
              onChange={(e) => setField('asunto', e.target.value)}
              disabled={isSubmittedSuccessfully}
              className={`w-full px-4 py-2.5 bg-background border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                errors.asunto
                  ? 'border-danger focus:ring-danger/20 focus:border-danger'
                  : 'border-border focus:ring-primary/20 focus:border-primary'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
              placeholder="Ej: Invitación al evento del mes..."
            />
            {errors.asunto && <p className="text-danger text-sm mt-1.5">{errors.asunto}</p>}
          </div>

          {/* Cuerpo */}
          <div>
            <label className="block text-base font-semibold text-dark mb-1.5">
              Contenido del correo <span className="text-danger">*</span>
            </label>
            <TiptapEditor />
          </div>

          {/* Fila 1: Toggle de Inscripción Múltiple */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.usa_links_multiples}
                  onChange={(e) => {
                    setField('usa_links_multiples', e.target.checked);
                    if (e.target.checked) {
                      setField('link_inscripcion', '');
                    } else {
                      setField('link_nacion', '');
                      setField('link_provincia', '');
                    }
                  }}
                  disabled={isSubmittedSuccessfully}
                />
                <div className={`block w-11 h-6 rounded-full transition-colors ${form.usa_links_multiples ? 'bg-primary' : 'bg-border'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${form.usa_links_multiples ? 'transform translate-x-5' : ''}`}></div>
              </div>
              <div className="text-base font-semibold text-dark group-hover:text-primary transition-colors select-none">
                Inscripción múltiple (Nación/Provincia)
              </div>
            </label>
          </div>

          {/* Fila 2: Primer Link y Fecha Límite */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Primer Link */}
            {!form.usa_links_multiples ? (
              <div className="animate-fade-in">
                <label htmlFor="link_inscripcion" className="block text-base font-semibold text-dark mb-1.5">
                  Link de inscripción <span className="text-danger">*</span>
                </label>
                <input
                  type="url"
                  id="link_inscripcion"
                  value={form.link_inscripcion}
                  onChange={(e) => setField('link_inscripcion', e.target.value)}
                  disabled={isSubmittedSuccessfully}
                  className={`w-full px-4 py-2.5 bg-background border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.link_inscripcion
                      ? 'border-danger focus:ring-danger/20 focus:border-danger'
                      : 'border-border focus:ring-primary/20 focus:border-primary'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  placeholder="https://form.ejemplo.com"
                />
                {errors.link_inscripcion && <p className="text-danger text-sm mt-1.5">{errors.link_inscripcion}</p>}
              </div>
            ) : (
              <div className="animate-fade-in">
                <label htmlFor="link_nacion" className="block text-base font-semibold text-dark mb-1.5">
                  Link Nación <span className="text-danger">*</span>
                </label>
                <input
                  type="url"
                  id="link_nacion"
                  value={form.link_nacion}
                  onChange={(e) => setField('link_nacion', e.target.value)}
                  disabled={isSubmittedSuccessfully}
                  className={`w-full px-4 py-2.5 bg-background border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.link_nacion
                      ? 'border-danger focus:ring-danger/20 focus:border-danger'
                      : 'border-border focus:ring-primary/20 focus:border-primary'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  placeholder="https://form.nacion.com"
                />
                {errors.link_nacion && <p className="text-danger text-sm mt-1.5">{errors.link_nacion}</p>}
              </div>
            )}

            {/* Fecha límite */}
            <div>
              <label htmlFor="fecha_limite_envio" className="block text-base font-semibold text-dark mb-1.5">
                Fecha límite de envío <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                id="fecha_limite_envio"
                value={form.fecha_limite_envio}
                onChange={(e) => setField('fecha_limite_envio', e.target.value)}
                min={(() => {
                  const tmr = new Date();
                  tmr.setDate(tmr.getDate() + 1);
                  return tmr.toISOString().split('T')[0];
                })()}
                disabled={isSubmittedSuccessfully}
                className={`w-full px-4 py-2.5 bg-background border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  errors.fecha_limite_envio
                    ? 'border-danger focus:ring-danger/20 focus:border-danger'
                    : 'border-border focus:ring-primary/20 focus:border-primary'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              />
              {errors.fecha_limite_envio && <p className="text-danger text-sm mt-1.5">{errors.fecha_limite_envio}</p>}
            </div>
          </div>

          {/* Fila 3: Segundo Link (solo si múltiple) */}
          {form.usa_links_multiples && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start animate-fade-in mb-8">
              <div>
                <label htmlFor="link_provincia" className="block text-base font-semibold text-dark mb-1.5">
                  Link Provincia <span className="text-danger">*</span>
                </label>
                <input
                  type="url"
                  id="link_provincia"
                  value={form.link_provincia}
                  onChange={(e) => setField('link_provincia', e.target.value)}
                  disabled={isSubmittedSuccessfully}
                  className={`w-full px-4 py-2.5 bg-background border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.link_provincia
                      ? 'border-danger focus:ring-danger/20 focus:border-danger'
                      : 'border-border focus:ring-primary/20 focus:border-primary'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  placeholder="https://form.provincia.com"
                />
                {errors.link_provincia && <p className="text-danger text-sm mt-1.5">{errors.link_provincia}</p>}
              </div>
            </div>
          )}

          {/* Flyer */}
          <div>
            <label className="block text-base font-semibold text-dark mb-1.5">
              Flyer adjunto <span className="text-muted text-sm font-normal">(Opcional)</span>
            </label>
            <FlyerUpload />
          </div>

          {/* Adjuntos Múltiples Toggle */}
          <div className="pt-4 border-t border-border">
            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer group w-fit">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={conAdjunto}
                    onChange={(e) => {
                      setConAdjunto(e.target.checked);
                      if (!e.target.checked) {
                        setAdjuntos([]);
                        setField('adjuntos_extras', []);
                      }
                    }}
                    disabled={isSubmittedSuccessfully}
                  />
                  <div className={`block w-14 h-8 rounded-full transition-colors ${conAdjunto ? 'bg-primary' : 'bg-border'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${conAdjunto ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <div className="text-base font-semibold text-dark group-hover:text-primary transition-colors">
                  Añadir adjuntos opcionales
                </div>
              </label>
              <p className="text-muted text-sm mt-1 ml-17">
                Permite enviar hasta {maxAdjuntos} archivos adjuntos (PDF, DOCX, CSV, Excel, Imágenes) en el correo.
              </p>
            </div>

            {conAdjunto && (
              <div className="animate-fade-in mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-base font-semibold text-dark">
                    Archivos Adjuntos <span className="text-muted text-sm font-normal">(máx. 10MB por archivo)</span>
                  </label>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                    adjuntos.length >= maxAdjuntos ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
                  }`}>
                    {adjuntos.length > 0 ? adjuntos.length : (form.adjuntos_extras?.length || 0)}/{maxAdjuntos} archivos
                  </span>
                </div>

                {/* Input para seleccionar múltiples archivos */}
                {adjuntos.length < maxAdjuntos && (
                  <div className="mb-3">
                    <input
                      id="adjuntos-input"
                      type="file"
                      multiple
                      accept=".pdf,.docx,.xlsx,.xls,.csv,image/*"
                      onChange={(e) => {
                        if (e.target.files) {
                          const nuevos = Array.from(e.target.files);
                          const combined = [...adjuntos, ...nuevos].slice(0, maxAdjuntos);
                          setAdjuntos(combined);
                          // Limpiar extras guardados si se suben nuevos
                          if (combined.length > 0) setField('adjuntos_extras', []);
                          e.target.value = '';
                        }
                      }}
                      disabled={isSubmittedSuccessfully}
                      className="block w-full text-sm text-muted
                        file:mr-4 file:py-2.5 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary file:text-white
                        hover:file:bg-primary-dark
                        file:cursor-pointer file:transition-colors
                        disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                )}

                {/* Lista de archivos nuevos seleccionados */}
                {adjuntos.length > 0 && (
                  <ul className="space-y-2">
                    {adjuntos.map((file, idx) => (
                      <li key={idx} className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                        <FileText size={16} className="text-primary shrink-0" />
                        <span className="text-sm text-dark flex-1 truncate" title={file.name}>{file.name}</span>
                        <span className="text-xs text-muted shrink-0">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                        <button
                          type="button"
                          onClick={() => setAdjuntos(adjuntos.filter((_, i) => i !== idx))}
                          disabled={isSubmittedSuccessfully}
                          className="ml-1 text-muted hover:text-danger transition-colors disabled:opacity-40"
                          title="Quitar este archivo"
                        >
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Archivos existentes (al editar un borrador) */}
                {adjuntos.length === 0 && form.adjuntos_extras && form.adjuntos_extras.length > 0 && (
                  <ul className="space-y-2">
                    {form.adjuntos_extras.map((adj, idx) => (
                      <li key={idx} className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                        <FileText size={16} className="text-muted shrink-0" />
                        <span className="text-sm text-dark flex-1 truncate" title={adj.nombre_original}>{adj.nombre_original}</span>
                        <span className="text-xs text-muted shrink-0 bg-background border border-border px-2 py-0.5 rounded-full">Guardado</span>
                        <button
                          type="button"
                          onClick={() => setField('adjuntos_extras', form.adjuntos_extras!.filter((_, i) => i !== idx))}
                          disabled={isSubmittedSuccessfully}
                          className="ml-1 text-muted hover:text-danger transition-colors disabled:opacity-40"
                          title="Quitar este archivo"
                        >
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border">
             {/* Prioridad */}
             <div>
              <label htmlFor="prioridad" className="block text-base font-semibold text-dark mb-1.5">
                Prioridad
              </label>
              <select
                id="prioridad"
                value={form.prioridad}
                onChange={(e) => setField('prioridad', e.target.value as 'alta' | 'media' | 'baja')}
                disabled={isSubmittedSuccessfully}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>

            {/* Configuración de Destinatarios */}
            <div>
              <div className="mb-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.para_todos_rubros}
                      onChange={(e) => setField('para_todos_rubros', e.target.checked)}
                      disabled={isSubmittedSuccessfully}
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${form.para_todos_rubros ? 'bg-primary' : 'bg-border'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${form.para_todos_rubros ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                  <div className="text-base font-semibold text-dark group-hover:text-primary transition-colors">
                    Enviar a todos los rubros
                  </div>
                </label>
                <p className="text-muted text-sm mt-1 ml-17">
                  Si se desmarca, podrás seleccionar rubros específicos.
                </p>
              </div>
            </div>
          </div>

          {/* Selector de Rubros (Condicional) */}
          {!form.para_todos_rubros && (
            <div className="pt-4 border-t border-border animate-fade-in">
              <label className="block text-base font-semibold text-dark mb-3">
                Seleccionar Rubros Destinatarios
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-4 bg-background rounded-lg border border-border">
                {/* Opción especial: Sin rubro */}
                <label key="__sin_rubro__" className="flex items-center gap-2.5 cursor-pointer hover:bg-surface p-2 rounded transition-colors border border-border bg-surface/50">
                  <input
                    type="checkbox"
                    checked={form.rubros_seleccionados.includes('__sin_rubro__')}
                    onChange={() => toggleRubro('__sin_rubro__')}
                    disabled={isSubmittedSuccessfully}
                    className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
                  />
                  <span className="text-dark select-none font-semibold">
                    Sin rubro asignado
                  </span>
                </label>

                {RUBROS_LIST.map((rubro) => (
                  <label key={rubro} className="flex items-center gap-2.5 cursor-pointer hover:bg-surface p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={form.rubros_seleccionados.includes(rubro)}
                      onChange={() => toggleRubro(rubro)}
                      disabled={isSubmittedSuccessfully}
                      className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
                    />
                    <span className="text-dark select-none">
                      {RUBROS_LABELS[rubro] || rubro}
                    </span>
                  </label>
                ))}
              </div>
              {errors.rubros_seleccionados && <p className="text-danger text-sm mt-2">{errors.rubros_seleccionados}</p>}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-background p-5 sm:px-8 border-t border-border flex flex-col xl:flex-row items-center justify-between gap-4 flex-wrap">
          <div className="flex w-full xl:w-auto flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                navigate('/preview');
                window.scrollTo(0, 0);
              }}
              disabled={isSubmittedSuccessfully}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-surface border border-border text-muted text-sm font-medium rounded-lg hover:bg-background hover:text-dark focus:outline-none focus:ring-2 focus:ring-border transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Eye size={18} />
              Vista Previa
            </button>
            <button
              type="button"
              onClick={handleMandarPrueba}
              disabled={isSubmitting || isSubmittedSuccessfully || isSendingTest}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-500 text-sm font-medium rounded-lg hover:bg-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSendingTest ? (
                <div className="w-4 h-4 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
              ) : (
                <Mail size={18} />
              )}
              {isSendingTest ? 'Enviando prueba...' : 'Mail de Prueba'}
            </button>
          </div>
          
          <div className="flex w-full xl:w-auto flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => guardarBorrador(id)}
              disabled={isSubmitting || isSubmittedSuccessfully}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Save size={18} />
              )}
              {id ? 'Actualizar Borrador' : 'Guardar Borrador'}
            </button>
            <button
              type="button"
              onClick={handleIntentarAprobar}
              disabled={isSubmitting || isSubmittedSuccessfully}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-secondary text-white text-sm font-medium rounded-lg hover:bg-secondary-dark focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <CheckCircle2 size={18} />
              )}
              Aprobar y Enviar
            </button>
          </div>
        </div>
      </div>

      {/* Botón flotante para volver arriba */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition-all duration-300 transform hover:scale-110 flex items-center justify-center gap-2 group"
          title="Volver arriba"
          aria-label="Volver arriba"
        >
          <ArrowUp size={20} className="group-hover:-translate-y-0.5 transition-transform" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-xs font-semibold pr-0 group-hover:pr-1">
            Volver arriba
          </span>
        </button>
      )}
    </div>
  );
}
