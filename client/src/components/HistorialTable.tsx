import { Eye, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('es');

export interface HistorialItem {
  id: number;
  usuario_id: number | null;
  usuario_nombre: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  detalles: any;
  creado_en: string;
}

interface Props {
  historial: HistorialItem[];
  showActor?: boolean;
}

export default function HistorialTable({ historial, showActor = false }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const formatAccion = (accion: string) => {
    switch (accion) {
      case 'CREAR': return <span className="bg-success/10 text-success text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded">Creación</span>;
      case 'ACTUALIZAR': return <span className="bg-warning/10 text-warning text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded">Edición</span>;
      case 'ELIMINAR': return <span className="bg-danger/10 text-danger text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded">Eliminación</span>;
      default: return <span className="bg-surface border border-border text-muted text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded">{accion}</span>;
    }
  };

  const formatDetallesEnLinea = (detalles: any) => {
    if (!detalles || typeof detalles !== 'object') return null;
    const keys = Object.keys(detalles);
    if (keys.length === 0) return null;
    
    // Mostramos un resumen (por ejemplo 1 o 2 propiedades clave)
    const previewKey = keys[0];
    const previewVal = String(detalles[previewKey]);
    return (
      <span className="text-xs text-muted truncate max-w-[200px] inline-block align-bottom ml-2">
        <span className="font-medium text-dark">{previewKey}:</span> {previewVal}
        {keys.length > 1 && ' ...'}
      </span>
    );
  };

  const DetalleAmpliado = ({ detalles }: { detalles: any }) => {
    if (!detalles) return <span className="text-muted italic">Sin detalles</span>;
    if (typeof detalles === 'string') return <span>{detalles}</span>;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-2">
        {Object.entries(detalles).map(([key, value]) => {
          let displayValue = String(value);
          if (typeof value === 'object' && value !== null) {
            displayValue = JSON.stringify(value);
          }
          const formattedKey = key.replace(/_/g, ' ');
          return (
            <div key={key} className="text-sm border-b border-border/50 pb-1">
              <span className="font-semibold text-dark capitalize mr-2">{formattedKey}:</span>
              <span className="text-muted break-all">{displayValue}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const formatEntidad = (entidad: string) => {
    const e = entidad.toLowerCase();
    if (e === 'campana') return 'Campaña';
    return e;
  };

  const getActionDescription = (item: HistorialItem) => {
    const entidadStr = formatEntidad(item.entidad);
    
    if (item.entidad.toLowerCase() === 'campana' && item.detalles?.asunto) {
      return `${item.accion} en ${entidadStr}: "${item.detalles.asunto}"`;
    }
    if (item.entidad.toLowerCase() === 'smtp' && item.detalles?.email) {
      return `${item.accion} en ${entidadStr}: ${item.detalles.email}`;
    }
    if (item.entidad.toLowerCase() === 'contacto' && item.detalles?.email) {
      return `${item.accion} en ${entidadStr}: ${item.detalles.email}`;
    }

    return `${item.accion} en ${entidadStr}`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
            {showActor && <th className="px-4 py-3 font-semibold">Actor</th>}
            <th className="px-4 py-3 font-semibold">Fecha y Hora</th>
            <th className="px-4 py-3 font-semibold">Tipo</th>
            <th className="px-4 py-3 font-semibold">Entidad</th>
            <th className="px-4 py-3 font-semibold w-1/2">Detalle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {historial.map((item) => {
            const hasDetails = item.detalles && typeof item.detalles === 'object' && Object.keys(item.detalles).length > 0;
            const isExpanded = expandedId === item.id;

            return (
              <React.Fragment key={item.id}>
                <tr 
                  className={`hover:bg-surface/50 transition-colors ${isExpanded ? 'bg-surface/50' : ''}`}
                >
                  {showActor && (
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-dark text-sm">
                        {item.usuario_nombre || 'Sistema'}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <div className="text-sm text-dark">{dayjs(item.creado_en).format('DD/MM/YYYY')}</div>
                    <div className="text-xs text-muted">{dayjs(item.creado_en).format('HH:mm:ss')}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {formatAccion(item.accion)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-dark text-sm capitalize">{formatEntidad(item.entidad)}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-dark flex items-center">
                          {getActionDescription(item)}
                          {!isExpanded && formatDetallesEnLinea(item.detalles)}
                        </div>
                        {hasDetails && (
                          <button 
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="mt-1 flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark transition-colors border border-primary/20 bg-primary/5 px-2 py-1 rounded-full"
                          >
                            {isExpanded ? (
                              <><ChevronUp size={14} /> Ocultar detalle</>
                            ) : (
                              <><Eye size={14} /> Ver detalle ({Object.keys(item.detalles).length} {Object.keys(item.detalles).length === 1 ? 'cambio' : 'cambios'})</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
                {isExpanded && hasDetails && (
                  <tr className="bg-surface/30">
                    <td colSpan={showActor ? 5 : 4} className="px-4 py-4 pb-6 border-b border-border shadow-inner">
                      <div className="bg-background rounded-lg border border-border p-4 shadow-sm">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 border-b border-border pb-2">Información del cambio</h4>
                        <DetalleAmpliado detalles={item.detalles} />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
