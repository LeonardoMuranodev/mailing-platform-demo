import { create } from 'zustand';
import type { CampanaFormData } from '../types/campana';
import { CAMPANA_FORM_INITIAL } from '../types/campana';
import { crearCampana, cambiarEstadoCampana } from '../services/api';
import { validarFormulario, validarBorrador } from '../schemas/campanaSchema';

const STORAGE_KEY = 'draft_campana_data';

interface CampanaStore {
  // ── Estado ─────────────────────────────────────
  form: CampanaFormData;
  flyer: File | null;
  flyerPreview: string | null;
  htmlPreview: string;
  errors: Record<string, string>;
  isSubmitting: boolean;
  submitResult: { success: boolean; message: string; id?: string } | null;

  // ── Acciones ───────────────────────────────────
  setField: <K extends keyof CampanaFormData>(field: K, value: CampanaFormData[K]) => void;
  setFlyer: (file: File | null) => void;
  setHtmlContent: (html: string) => void;
  toggleRubro: (rubro: string) => void;
  reset: () => void;
  clearErrors: () => void;
  clearResult: () => void;

  // ── Submit ─────────────────────────────────────
  guardarBorrador: () => Promise<void>;
  aprobarCampana: () => Promise<void>;
}

export const useCampanaStore = create<CampanaStore>((set, get) => ({
  // ── Estado inicial ──────────────────────────────
  form: { ...CAMPANA_FORM_INITIAL },
  flyer: null,
  flyerPreview: null,
  htmlPreview: '',
  errors: {},
  isSubmitting: false,
  submitResult: null,

  // ── Acciones ────────────────────────────────────
  setField: (field, value) =>
    set((state) => ({
      form: { ...state.form, [field]: value },
      errors: { ...state.errors, [field]: '' },
    })),

  setFlyer: (file) => {
    // Revocar URL anterior para evitar memory leaks
    const prevUrl = get().flyerPreview;
    if (prevUrl) URL.revokeObjectURL(prevUrl);

    set({
      flyer: file,
      flyerPreview: file ? URL.createObjectURL(file) : null,
    });
  },

  setHtmlContent: (html) =>
    set((state) => ({
      form: { ...state.form, cuerpo_html: html },
      htmlPreview: html,
      errors: { ...state.errors, cuerpo_html: '' },
    })),

  toggleRubro: (rubro) =>
    set((state) => {
      const current = state.form.rubros_seleccionados;
      const updated = current.includes(rubro)
        ? current.filter((r) => r !== rubro)
        : [...current, rubro];
      return {
        form: { ...state.form, rubros_seleccionados: updated },
      };
    }),

  reset: () => {
    const prevUrl = get().flyerPreview;
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    set({
      form: { ...CAMPANA_FORM_INITIAL },
      flyer: null,
      flyerPreview: null,
      htmlPreview: '',
      errors: {},
      isSubmitting: false,
      submitResult: null,
    });
    localStorage.removeItem(STORAGE_KEY);
  },

  clearErrors: () => set({ errors: {} }),
  clearResult: () => set({ submitResult: null }),

  // ── Submit ──────────────────────────────────────
  guardarBorrador: async () => {
    const { form, flyer } = get();

    // Validar con Zod de forma laxa
    const validationErrors = validarBorrador(form);
    if (validationErrors) {
      set({ errors: validationErrors });
      return;
    }

    set({ isSubmitting: true, errors: {}, submitResult: null });

    try {
      const fd = buildFormData(form, flyer);
      const res = await crearCampana(fd);

      if (res.success && res.data) {
        localStorage.removeItem(STORAGE_KEY);
        set({
          submitResult: {
            success: true,
            message: 'Campaña guardada como borrador exitosamente.',
            id: res.data.id,
          },
        });
      } else {
        set({
          submitResult: {
            success: false,
            message: res.error?.message ?? 'Error al guardar la campaña.',
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión con el servidor.';
      set({ submitResult: { success: false, message: msg } });
    } finally {
      set({ isSubmitting: false });
    }
  },

  aprobarCampana: async () => {
    const { form, flyer } = get();

    // Validar con Zod
    const validationErrors = validarFormulario(form);
    if (validationErrors) {
      set({ errors: validationErrors });
      return;
    }

    set({ isSubmitting: true, errors: {}, submitResult: null });

    try {
      // 1. Crear la campaña como borrador
      const fd = buildFormData(form, flyer);
      const createRes = await crearCampana(fd);

      if (!createRes.success || !createRes.data) {
        set({
          submitResult: {
            success: false,
            message: createRes.error?.message ?? 'Error al crear la campaña.',
          },
        });
        return;
      }

      // 2. Aprobar inmediatamente
      const approveRes = await cambiarEstadoCampana(createRes.data.id, 'aprobada');

      if (approveRes.success) {
        localStorage.removeItem(STORAGE_KEY);
        set({
          submitResult: {
            success: true,
            message: 'Campaña aprobada y lista para envío.',
            id: createRes.data.id,
          },
        });
      } else {
        set({
          submitResult: {
            success: false,
            message: approveRes.error?.message ?? 'La campaña se creó pero no se pudo aprobar.',
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión con el servidor.';
      set({ submitResult: { success: false, message: msg } });
    } finally {
      set({ isSubmitting: false });
    }
  },
}));

// ── Helper ────────────────────────────────────────────────
function buildFormData(form: CampanaFormData, flyer: File | null): FormData {
  const fd = new FormData();
  fd.append('asunto', form.asunto);
  fd.append('cuerpo_html', form.cuerpo_html);
  fd.append('fecha_limite_envio', form.fecha_limite_envio);
  fd.append('prioridad', form.prioridad);
  fd.append('para_todos_rubros', String(form.para_todos_rubros));
  fd.append('rubros_seleccionados', JSON.stringify(form.rubros_seleccionados));

  if (form.link_inscripcion) {
    fd.append('link_inscripcion', form.link_inscripcion);
  }

  if (flyer) {
    fd.append('flyer', flyer);
  }

  return fd;
}
