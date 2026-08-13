import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Tag, Phone, Mail as MailIcon } from 'lucide-react';
import { useCampanaStore } from '../stores/campanaStore';
import { formatDate } from '../utils/formatDate';
import { RUBROS_LABELS } from '../data/rubros';
import headerImg from '../assets/header_direccion_produccion.png';

export default function VistaPrevia() {
  const navigate = useNavigate();
  const { form, flyerPreview, htmlPreview } = useCampanaStore();

  // Resolver labels de rubros seleccionados
  const rubrosDisplay = form.para_todos_rubros
    ? 'Todos los rubros'
    : form.rubros_seleccionados
        .map((r) => RUBROS_LABELS[r] || r)
        .join(', ') || 'Ninguno seleccionado';

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6">
      {/* Top Bar */}
      <div className="max-w-[680px] mx-auto mb-6 flex justify-between items-center">
        <button
          onClick={() => navigate('/nueva')}
          className="flex items-center gap-2 text-slate-600 hover:text-primary font-medium transition-colors bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm"
        >
          <ArrowLeft size={18} />
          Volver al formulario
        </button>
        <span className="text-sm text-slate-500 font-medium px-3 py-1 bg-slate-200 rounded-full">
          Modo de Vista Previa
        </span>
      </div>

      {/* ═══ EMAIL TEMPLATE ═══ */}
      <div className="email-preview-paper animate-fade-in">

        {/* ── Header: Dirección de Producción banner ── */}
        <div className="email-template-header">
          <img
            src={headerImg}
            alt="Dirección de Producción — Municipalidad de Tres de Febrero"
            className="w-full h-auto block"
          />
        </div>

        {/* ── Body: Contenido HTML del editor ── */}
        <div className="email-body">
          {htmlPreview ? (
            <div
              className="email-html-content"
              dangerouslySetInnerHTML={{ __html: htmlPreview }}
            />
          ) : (
            <p className="text-slate-400 italic py-4">
              El contenido del correo aparecerá aquí...
            </p>
          )}

          {/* ── Botón "¡Inscribite!" (solo si hay link) ── */}
          {form.link_inscripcion && (
            <div className="email-cta-wrapper">
              <a
                href={form.link_inscripcion}
                target="_blank"
                rel="noopener noreferrer"
                className="email-cta-button"
              >
                ¡Inscribite!
              </a>
            </div>
          )}

          {/* ── Flyer (solo si se cargó) ── */}
          {flyerPreview && (
            <div className="email-flyer-wrapper">
              <img
                src={flyerPreview}
                alt="Flyer de la campaña"
                className="w-full h-auto block"
              />
            </div>
          )}
        </div>

        {/* ── Footer: Comunicate con la Dirección de Producción ── */}
        <div className="email-template-footer">
          <p className="email-footer-title">
            Comunicate con la Dirección de Producción
          </p>
          <div className="email-footer-contacts">
            <a
              href="https://wa.me/5491100000000"
              target="_blank"
              rel="noopener noreferrer"
              className="email-footer-icon"
              title="WhatsApp"
            >
              <Phone size={22} />
            </a>
            <a
              href="mailto:produccion@tresdefebrero.gov.ar"
              className="email-footer-icon"
              title="Email"
            >
              <MailIcon size={22} />
            </a>
          </div>
        </div>
      </div>

      {/* ═══ METADATA CARDS (debajo de la simulación) ═══ */}
      <div className="max-w-[680px] mx-auto mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Rubros */}
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex items-start gap-3 shadow-sm">
          <Tag size={18} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
              Destinatarios
            </p>
            <p className="text-sm text-dark font-medium leading-snug">
              {rubrosDisplay}
            </p>
          </div>
        </div>

        {/* Fecha límite */}
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex items-start gap-3 shadow-sm">
          <Calendar size={18} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
              Fecha límite
            </p>
            <p className="text-sm text-dark font-medium">
              {form.fecha_limite_envio ? formatDate(form.fecha_limite_envio) : 'No definida'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
