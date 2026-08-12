import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Calendar, ExternalLink } from 'lucide-react';
import { useCampanaStore } from '../stores/campanaStore';
import { formatDate } from '../utils/formatDate';

export default function VistaPrevia() {
  const navigate = useNavigate();
  const { form, flyerPreview, htmlPreview } = useCampanaStore();

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-[680px] mx-auto mb-6 flex justify-between items-center">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-600 hover:text-primary font-medium transition-colors bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm"
        >
          <ArrowLeft size={18} />
          Volver al formulario
        </button>
        <span className="text-sm text-slate-500 font-medium px-3 py-1 bg-slate-200 rounded-full">
          Modo de Vista Previa
        </span>
      </div>

      <div className="email-preview-paper animate-fade-in">
        {/* Email Header Simulation */}
        <div className="email-header">
          <h2 className="text-xl font-bold text-dark mb-4">
            {form.asunto || '(Sin Asunto)'}
          </h2>
          <div className="flex items-center gap-3 text-sm text-slate-600 mb-2">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-lg">
              <User size={20} />
            </div>
            <div>
              <p className="font-semibold text-dark">Municipalidad de Tres de Febrero</p>
              <p>comunicacion@tresdefebrero.gov.ar</p>
            </div>
          </div>
        </div>

        {/* Email Body */}
        <div className="email-body">
          {flyerPreview && (
            <div className="mb-6 rounded-lg overflow-hidden border border-slate-100">
              <img
                src={flyerPreview}
                alt="Flyer de la campaña"
                className="w-full h-auto block"
              />
            </div>
          )}

          {htmlPreview ? (
            <div
              className="prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlPreview }}
            />
          ) : (
            <p className="text-slate-400 italic">
              El contenido del correo aparecerá aquí...
            </p>
          )}

          {form.link_inscripcion && (
            <div className="mt-8 text-center">
              <a
                href={form.link_inscripcion}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
              >
                Inscribirse aquí
                <ExternalLink size={18} />
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[680px] mx-auto mt-6 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
         <Calendar size={16} />
         Fecha límite configurada: {form.fecha_limite_envio ? formatDate(form.fecha_limite_envio) : 'No definida'}
      </div>
    </div>
  );
}
