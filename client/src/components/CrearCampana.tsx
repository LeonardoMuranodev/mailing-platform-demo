import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2, Save, Eye, ArrowLeft, Plus, List, FileText } from 'lucide-react';
import { useCampanaStore } from '../stores/campanaStore';
import TiptapEditor from './TiptapEditor';
import FlyerUpload from './FlyerUpload';
import { RUBROS_LIST, RUBROS_LABELS } from '../data/rubros';
import AlertMessage from './ui/AlertMessage';
import { enviarMailPruebaCampana } from '../services/api';

export default function CrearCampana() {
  const navigate = useNavigate();
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const {
    form,
    errors,
    setField,
    toggleRubro,
    guardarBorrador,
    aprobarCampana,
    isSubmitting,
    submitResult,
    clearResult,
    reset,
  } = useCampanaStore();

  // Limpiar mensajes y resetear el form si venimos de un envío exitoso
  useEffect(() => {
    if (useCampanaStore.getState().submitResult?.success) {
      reset();
    } else {
      clearResult();
    }
  }, [clearResult, reset]);

  // Cargar borrador de localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem('draft_campana_data');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        Object.entries(parsed).forEach(([k, v]) => {
          if (k !== 'flyer_url' && k !== 'flyer') { // Evitamos cargar archivos por seguridad
            setField(k as any, v);
          }
        });
      } catch (err) {
        console.error('Error parsing draft data', err);
      }
    }
  }, [setField]);

  // Guardar en localStorage cada vez que cambie 'form'
  useEffect(() => {
    localStorage.setItem('draft_campana_data', JSON.stringify(form));
  }, [form]);

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
    if (!form.asunto || !form.cuerpo_html) {
      setTestResult({ success: false, message: 'El asunto y el cuerpo del correo son requeridos para la prueba.' });
      return;
    }
    
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await enviarMailPruebaCampana(form.asunto, form.cuerpo_html, form.flyer_url, form.link_inscripcion);
      if (res.success) {
        setTestResult({ success: true, message: res.data?.message || 'Mail de prueba enviado con éxito' });
      } else {
        setTestResult({ success: false, message: res.error?.message || 'Error al enviar mail de prueba' });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Error de red' });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Bloquear formulario si ya se envió exitosamente
  const isSubmittedSuccessfully = submitResult?.success === true;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6 flex items-center">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted hover:text-dark font-medium transition-colors bg-surface px-4 py-2 rounded-lg border border-border shadow-sm mr-4"
        >
          <ArrowLeft size={18} />
          Volver
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Mail className="text-primary" />
          Nueva Campaña de Correo
        </h1>
        <p className="text-muted mt-1">
          Completá los datos para armar el comunicado.
        </p>
      </div>

      {/* Error message (solo errores, no éxito) */}
      {submitResult && !submitResult.success && (
        <div className="mb-6">
          <AlertMessage
            type="error"
            message={submitResult.message}
            onClose={clearResult}
          />
        </div>
      )}

      {/* Test result message */}
      {testResult && (
        <div className="mb-6">
          <AlertMessage
            type={testResult.success ? "success" : "error"}
            message={testResult.message}
            onClose={() => setTestResult(null)}
          />
        </div>
      )}

      {/* ═══ MODAL DE ÉXITO ═══ */}
      {submitResult?.success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-md rounded-xl border border-border shadow-2xl overflow-hidden animate-fade-in">
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
        </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Link de inscripción */}
            <div>
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

          {/* Flyer */}
          <div>
            <label className="block text-base font-semibold text-dark mb-1.5">
              Flyer adjunto <span className="text-danger">*</span>
            </label>
            <FlyerUpload />
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
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-muted text-xs font-medium rounded-lg hover:bg-background hover:text-dark focus:outline-none focus:ring-2 focus:ring-border transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Eye size={16} />
              Vista Previa
            </button>
            <button
              type="button"
              onClick={handleMandarPrueba}
              disabled={isSubmitting || isSubmittedSuccessfully || isSendingTest}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-500 text-xs font-medium rounded-lg hover:bg-yellow-500/20 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSendingTest ? (
                <div className="w-3.5 h-3.5 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
              ) : (
                <Mail size={16} />
              )}
              Mail de Prueba
            </button>
          </div>
          
          <div className="flex w-full xl:w-auto flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={guardarBorrador}
              disabled={isSubmitting || isSubmittedSuccessfully}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
            >
              {isSubmitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Save size={16} />
              )}
              Guardar Borrador
            </button>
            <button
              type="button"
              onClick={aprobarCampana}
              disabled={isSubmitting || isSubmittedSuccessfully}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-secondary text-white text-xs font-medium rounded-lg hover:bg-secondary-dark focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
            >
              {isSubmitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <CheckCircle2 size={16} />
              )}
              Aprobar y Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
