import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2, Save, X, Eye } from 'lucide-react';
import { useCampanaStore } from '../stores/campanaStore';
import TiptapEditor from './TiptapEditor';
import FlyerUpload from './FlyerUpload';
import { RUBROS_LIST, RUBROS_LABELS } from '../data/rubros';

export default function CrearCampana() {
  const navigate = useNavigate();
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

  // Limpiar mensajes de resultado al montar
  useEffect(() => {
    clearResult();
  }, [clearResult]);

  const handleSuccessRedirect = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Mail className="text-primary" />
          Nueva Campaña de Correo
        </h1>
        <p className="text-slate-500 mt-1">
          Completá los datos para armar el comunicado.
        </p>
      </div>

      {submitResult && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 animate-fade-in ${
            submitResult.success
              ? 'bg-success-light text-success-dark border border-success/20'
              : 'bg-danger-light text-danger border border-danger/20'
          }`}
        >
          {submitResult.success ? (
            <CheckCircle2 className="shrink-0 mt-0.5" />
          ) : (
            <X className="shrink-0 mt-0.5" />
          )}
          <div className="flex-grow">
            <h3 className="font-semibold">{submitResult.success ? '¡Éxito!' : 'Error'}</h3>
            <p className="text-sm mt-1 opacity-90">{submitResult.message}</p>
          </div>
          {submitResult.success && (
            <button
              onClick={handleSuccessRedirect}
              className="text-sm font-medium underline px-2 py-1"
            >
              Crear otra
            </button>
          )}
          <button onClick={clearResult} className="opacity-60 hover:opacity-100">
            <X size={20} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
              className={`w-full px-4 py-2.5 bg-background border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                errors.asunto
                  ? 'border-danger focus:ring-danger/20 focus:border-danger'
                  : 'border-slate-300 focus:ring-primary/20 focus:border-primary'
              }`}
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
                className={`w-full px-4 py-2.5 bg-background border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  errors.link_inscripcion
                    ? 'border-danger focus:ring-danger/20 focus:border-danger'
                    : 'border-slate-300 focus:ring-primary/20 focus:border-primary'
                }`}
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
                className={`w-full px-4 py-2.5 bg-background border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  errors.fecha_limite_envio
                    ? 'border-danger focus:ring-danger/20 focus:border-danger'
                    : 'border-slate-300 focus:ring-primary/20 focus:border-primary'
                }`}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100">
             {/* Prioridad */}
             <div>
              <label htmlFor="prioridad" className="block text-base font-semibold text-dark mb-1.5">
                Prioridad
              </label>
              <select
                id="prioridad"
                value={form.prioridad}
                onChange={(e) => setField('prioridad', e.target.value as 'alta' | 'media' | 'baja')}
                className="w-full px-4 py-2.5 bg-background border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
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
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${form.para_todos_rubros ? 'bg-primary' : 'bg-slate-300'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${form.para_todos_rubros ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                  <div className="text-base font-semibold text-dark group-hover:text-primary transition-colors">
                    Enviar a todos los rubros
                  </div>
                </label>
                <p className="text-slate-500 text-sm mt-1 ml-17">
                  Si se desmarca, podrás seleccionar rubros específicos.
                </p>
              </div>
            </div>
          </div>

          {/* Selector de Rubros (Condicional) */}
          {!form.para_todos_rubros && (
            <div className="pt-4 border-t border-slate-100 animate-fade-in">
              <label className="block text-base font-semibold text-dark mb-3">
                Seleccionar Rubros Destinatarios
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-4 bg-slate-50 rounded-lg border border-slate-200">
                {RUBROS_LIST.map((rubro) => (
                  <label key={rubro} className="flex items-center gap-2.5 cursor-pointer hover:bg-white p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={form.rubros_seleccionados.includes(rubro)}
                      onChange={() => toggleRubro(rubro)}
                      className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                    />
                    <span className="text-slate-700 select-none">
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
        <div className="bg-slate-50 p-6 sm:px-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex w-full sm:w-auto gap-4">
            <button
              type="button"
              onClick={() => navigate('/preview')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 hover:text-dark focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
            >
              <Eye size={20} />
              Ver Vista Previa
            </button>
          </div>
          
          <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={guardarBorrador}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Save size={20} />
              Guardar Borrador
            </button>
            <button
              type="button"
              onClick={aprobarCampana}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-secondary text-white font-medium rounded-lg hover:bg-secondary-dark focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <CheckCircle2 size={20} />
              Aprobar y Enviar Campaña
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
