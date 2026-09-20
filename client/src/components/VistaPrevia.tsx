import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Tag } from 'lucide-react';
import { useCampanaStore } from '../stores/campanaStore';
import { formatDate } from '../utils/formatDate';
import { RUBROS_LABELS } from '../data/rubros';

/** URL del header subido a Supabase */
const HEADER_URL = '/banner-vista-previa.png';

/** Iconos de contacto (Flaticon) */
const WHATSAPP_ICON = 'https://cdn-icons-png.flaticon.com/512/733/733585.png';
const MAIL_ICON = 'https://cdn-icons-png.flaticon.com/512/732/732200.png';

export default function VistaPrevia() {
  const navigate = useNavigate();
  const { form, flyerPreview, htmlPreview } = useCampanaStore();

  // Scroll al tope al montar
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Resolver labels de rubros seleccionados
  const rubrosDisplay = form.para_todos_rubros
    ? 'Todos los rubros'
    : form.rubros_seleccionados
        .map((r) => RUBROS_LABELS[r] || r)
        .join(', ') || 'Ninguno seleccionado';

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6">
      {/* Top Bar */}
      <div className="max-w-[650px] mx-auto mb-6 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <button
          onClick={() => navigate('/nueva')}
          className="flex items-center justify-center gap-2 text-muted hover:text-primary font-medium transition-colors bg-surface px-4 py-2 rounded-lg border border-border shadow-sm w-full sm:w-auto"
        >
          <ArrowLeft size={18} />
          Volver al formulario
        </button>
        <div className="flex justify-center">
          <span className="text-sm text-muted font-medium px-3 py-1 bg-background rounded-full border border-border text-center">
            Modo de Vista Previa
          </span>
        </div>
      </div>

      {/* ═══ EMAIL TEMPLATE ═══ */}
      <div className="email-preview-paper animate-fade-in">

        {/* ── Header: Banner de Dirección de Producción (Supabase) ── */}
        <div className="email-template-header">
          <img
            src={HEADER_URL}
            alt="Banner Generico"
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
        </div>

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

        {/* ── Flyer (solo si se cargó) — fondo #f0f4f8 ── */}
        {flyerPreview && (
          <div className="email-flyer-wrapper">
            <img
              src={flyerPreview}
              alt="Flyer del Evento"
            />
          </div>
        )}

        {/* ── Footer: Comunicate con la Dirección de Producción ── */}
        <div className="email-template-footer">
          <div className="email-footer-text">
            Comunicate:
          </div>
          <div className="email-footer-icons">
            <a
              href="https://wa.me/5491140659649"
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp"
            >
              <img
                className="email-footer-icon-img"
                src={WHATSAPP_ICON}
                alt="WhatsApp"
              />
            </a>
            <a
              href="mailto:contacto@genmailer.com"
              title="Mail"
            >
              <img
                className="email-footer-icon-img"
                src={MAIL_ICON}
                alt="Mail"
              />
            </a>
          </div>
        </div>
      </div>

      {/* ═══ METADATA CARDS (debajo de la simulación) ═══ */}
      <div className="max-w-[650px] mx-auto mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Rubros */}
        <div className="bg-surface rounded-lg border border-border px-4 py-3 flex items-start gap-3 shadow-sm transition-colors">
          <Tag size={18} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
              Destinatarios
            </p>
            <p className="text-sm text-dark font-medium leading-snug">
              {rubrosDisplay}
            </p>
          </div>
        </div>

        {/* Fecha límite */}
        <div className="bg-surface rounded-lg border border-border px-4 py-3 flex items-start gap-3 shadow-sm transition-colors">
          <Calendar size={18} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
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
