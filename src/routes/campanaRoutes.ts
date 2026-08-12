import { Router, type Request, type Response } from 'express';
import { upload } from '../config/multerConfig.js';
import {
  crearCampana,
  cambiarEstadoCampana,
  obtenerCampanaPorId,
} from '../services/campanaService.js';
import type {
  CambiarEstadoInput,
  CrearCampanaInput,
} from '../types/campana.js';

export const campanaRouter = Router();

/**
 * POST /api/campanas
 * Acepta multipart/form-data con campo opcional 'flyer' (archivo).
 * Los demás campos van en el body (form fields).
 */
campanaRouter.post('/', upload.single('flyer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;

    const flyerUrl = req.file
      ? `/uploads/${req.file.filename}`
      : (body.flyer_url as string | undefined);

    const input: CrearCampanaInput = {
      asunto: body.asunto as string,
      cuerpo_html: body.cuerpo_html as string,
      link_inscripcion: body.link_inscripcion as string | undefined,
      flyer_url: flyerUrl,
      fecha_limite_envio: body.fecha_limite_envio as string,
      prioridad: body.prioridad as CrearCampanaInput['prioridad'],
      para_todos_rubros: body.para_todos_rubros === 'true' || body.para_todos_rubros === true,
      rubros_seleccionados: typeof body.rubros_seleccionados === 'string'
        ? JSON.parse(body.rubros_seleccionados) as string[]
        : (body.rubros_seleccionados as string[] | undefined),
    };

    // Validaciones mínimas
    if (!input.asunto || !input.cuerpo_html || !input.fecha_limite_envio) {
      res.status(400).json({
        error: 'Campos obligatorios faltantes: asunto, cuerpo_html, fecha_limite_envio',
      });
      return;
    }

    const campana = await crearCampana(input);
    res.status(201).json(campana);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/campanas] Error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/campanas/:id
 * Devuelve la campaña completa por UUID.
 */
campanaRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    const campana = await obtenerCampanaPorId(id);
    if (!campana) {
      res.status(404).json({ error: 'Campaña no encontrada' });
      return;
    }
    res.json(campana);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[GET /api/campanas/${id}] Error:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/campanas/:id/estado
 * Body: { estado: 'aprobada' | 'cancelada' | ... }
 */
campanaRouter.patch('/:id/estado', async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    const { estado } = req.body as CambiarEstadoInput;

    if (!estado) {
      res.status(400).json({ error: 'El campo "estado" es obligatorio' });
      return;
    }

    const campana = await cambiarEstadoCampana(id, estado);
    if (!campana) {
      res.status(404).json({ error: 'Campaña no encontrada' });
      return;
    }
    res.json(campana);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[PATCH /api/campanas/${id}/estado] Error:`, message);
    res.status(500).json({ error: message });
  }
});
