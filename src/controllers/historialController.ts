import { Request, Response, NextFunction } from 'express';
import { obtenerHistorial } from '../services/historialService.js';

export const getHistorial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const historial = await obtenerHistorial();
        res.json({ success: true, data: historial });
    } catch (error) {
        next(error);
    }
};

export const getMiHistorial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usuarioId = req.user?.userId;
        if (!usuarioId) {
            res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } });
            return;
        }
        const historial = await obtenerHistorial(usuarioId);
        res.json({ success: true, data: historial });
    } catch (error) {
        next(error);
    }
};
