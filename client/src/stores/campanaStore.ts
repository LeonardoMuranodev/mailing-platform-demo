import { create } from 'zustand';
import type { CampanaFormData } from '../types/campana';
import { CAMPANA_FORM_INITIAL } from '../types/campana';
import { crearCampana, actualizarCampana, cambiarEstadoCampana, obtenerConfigCampana } from '../services/api';
import { validarFormulario, validarBorrador } from '../schemas/campanaSchema';
import { useNotificationStore } from './useNotificationStore';

const STORAGE_KEY = 'draft_campana_data';

const DEFAULT_MAX_ADJUNTOS = parseInt(import.meta.env.VITE_MAX_ADJUNTOS || '6', 10) || 6;

interface CampanaStore {
  // ── Estado ─────────────────────────────────────
  form: CampanaFormData;
  flyer: File | null;
  flyerPreview: string | null;
  adjuntos: File[];
  adjuntosNames: string[];
  maxAdjuntos: number;
  htmlPreview: string;
  errors: Record<string, string>;
  isSubmitting: boolean;
  submitResult: { success: boolean; message: string; id?: string; mode?: 'borrador' | 'aprobada' } | null;

  // ── Acciones ───────────────────────────────────
  cargarConfig: () => Promise<void>;
  setField: <K extends keyof CampanaFormData>(field: K, value: CampanaFormData[K]) => void;
  setFlyer: (file: File | null) => void;
  setAdjuntos: (files: File[]) => void;
  setHtmlContent: (html: string) => void;
  toggleRubro: (rubro: string) => void;
  reset: () => void;
  clearErrors: () => void;
  clearResult: () => void;

  // ── Submit ─────────────────────────────────────
  guardarBorrador: (id?: string) => Promise<void>;
  aprobarCampana: (id?: string) => Promise<void>;
}

export const useCampanaStore = create<CampanaStore>((set, get) => ({
  // ── Estado inicial ──────────────────────────────
  form: { ...CAMPANA_FORM_INITIAL },
  flyer: null,
  flyerPreview: null,
  adjuntos: [],
  adjuntosNames: [],
  maxAdjuntos: DEFAULT_MAX_ADJUNTOS,
  htmlPreview: '',
  errors: {},
  isSubmitting: false,
  submitResult: null,

  cargarConfig: async () => {
    try {
      const res = await obtenerConfigCampana();
      if (res.success && res.data?.maxAdjuntos) {
        set({ maxAdjuntos: res.data.maxAdjuntos });
      }
    } catch {
      // Ignorar error y mantener DEFAULT_MAX_ADJUNTOS
    }
  },

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

  setAdjuntos: (files) => {
    set({
      adjuntos: files,
      adjuntosNames: files.map((f) => f.name),
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
      adjuntos: [],
      adjuntosNames: [],
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
  guardarBorrador: async (id?: string) => {
    const { form, flyer, adjuntos } = get();

    // Validar con Zod de forma laxa
    const validationErrors = validarBorrador(form);
    if (validationErrors) {
      set({ 
        errors: validationErrors,
        submitResult: { success: false, message: 'Revisa los campos marcados en rojo.' }
      });
      return;
    }

    set({ isSubmitting: true, errors: {}, submitResult: null });

    try {
      const fd = buildFormData(form, flyer, adjuntos);
      let res;
      if (id) {
        res = await actualizarCampana(id, fd);
      } else {
        res = await crearCampana(fd);
      }

      if (res.success && res.data) {
        localStorage.removeItem(STORAGE_KEY);
        set({
          submitResult: {
            success: true,
            message: id ? 'Borrador actualizado exitosamente.' : 'Campaña guardada como borrador exitosamente.',
            id: res.data.id,
            mode: 'borrador',
          },
        });
      } else {
        const errorMsg = res.error?.message ?? 'Error al guardar la campaña.';
        const fieldErrors = res.error?.details?.reduce((acc: Record<string, string>, curr: any) => {
          acc[curr.field] = curr.message;
          return acc;
        }, {}) || {};
        
        set({
          errors: fieldErrors,
          submitResult: {
            success: false,
            message: errorMsg,
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

  aprobarCampana: async (id?: string) => {
    const { form, flyer, adjuntos } = get();

    // Validar con Zod
    const validationErrors = validarFormulario(form);
    if (validationErrors) {
      set({ 
        errors: validationErrors,
        submitResult: { success: false, message: 'Revisa los campos marcados en rojo.' }
      });
      return;
    }

    set({ isSubmitting: true, errors: {}, submitResult: null });

    try {
      // 1. Crear o actualizar la campaña como borrador
      const fd = buildFormData(form, flyer, adjuntos);
      let createRes;
      if (id) {
        createRes = await actualizarCampana(id, fd);
      } else {
        createRes = await crearCampana(fd);
      }

      if (!createRes.success || !createRes.data) {
        set({
          submitResult: {
            success: false,
            message: createRes.error?.message ?? 'Error al guardar la campaña.',
          },
        });
        return;
      }

      // 2. Aprobar inmediatamente
      const approveRes = await cambiarEstadoCampana(createRes.data.id, 'aprobada');

      if (approveRes.success) {
        localStorage.removeItem(STORAGE_KEY);
        useNotificationStore.getState().agregarNotificacion({
          tipo: 'campaign_approved',
          titulo: 'Campaña Aprobada',
          mensaje: `La campaña "${form.asunto}" fue aprobada y quedó lista para su envío.`,
          urlDestino: `/campanas/${createRes.data.id}`,
          timestamp: new Date().toISOString(),
        });
        set({
          submitResult: {
            success: true,
            message: 'Campaña aprobada y lista para envío.',
            id: createRes.data.id,
            mode: 'aprobada',
          },
        });
      } else {
        const errorMsg = approveRes.error?.message ?? 'La campaña se creó pero no se pudo aprobar.';
        const fieldErrors = approveRes.error?.details?.reduce((acc: Record<string, string>, curr: any) => {
          acc[curr.field] = curr.message;
          return acc;
        }, {}) || {};
        
        set({
          errors: fieldErrors,
          submitResult: {
            success: false,
            message: errorMsg,
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
export function buildFormData(form: CampanaFormData, flyer: File | null, adjuntos: File[]): FormData {
  const fd = new FormData();
  fd.append('asunto', form.asunto);
  fd.append('cuerpo_html', form.cuerpo_html);
  fd.append('fecha_limite_envio', form.fecha_limite_envio);
  fd.append('prioridad', form.prioridad);
  fd.append('para_todos_rubros', String(form.para_todos_rubros));
  fd.append('rubros_seleccionados', JSON.stringify(form.rubros_seleccionados));
  fd.append('tipo_audiencia', form.tipo_audiencia || 'rubros');
  fd.append('destinatarios_manuales', JSON.stringify(form.destinatarios_manuales || []));

  if (form.link_inscripcion) {
    fd.append('link_inscripcion', form.link_inscripcion);
  }
  if (form.link_nacion) {
    fd.append('link_nacion', form.link_nacion);
  }
  if (form.link_provincia) {
    fd.append('link_provincia', form.link_provincia);
  }

  if (flyer) {
    fd.append('flyer', flyer);
  }

  // Múltiples adjuntos: subir como 'adjuntos'
  if (adjuntos && adjuntos.length > 0) {
    adjuntos.forEach((file) => fd.append('adjuntos', file));
  } else if (form.adjuntos_extras && form.adjuntos_extras.length > 0) {
    // Al editar sin subir nuevos archivos, preservar los existentes como JSON
    fd.append('adjuntos_extras', JSON.stringify(form.adjuntos_extras));
  }

  return fd;
}
