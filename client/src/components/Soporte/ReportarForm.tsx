import React, { useState } from 'react';
import { Send, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { crearReporteSoporte } from '../../services/api';
import logo3f from '../../assets/logo-3f.png';

export default function ReportarForm() {
  const [form, setForm] = useState({ tipo: 'mejora', descripcion: '' });
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.tipo) {
      setErrorMsg('Por favor, selecciona un tipo de reporte.');
      return;
    }
    if (!form.descripcion || form.descripcion.trim().length < 5) {
      setErrorMsg('La descripción debe tener al menos 5 caracteres.');
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('tipo', form.tipo);
    formData.append('descripcion', form.descripcion);
    if (file) formData.append('adjunto', file);

    try {
      const res = await crearReporteSoporte(formData);
      
      if (res.success) {
        setSuccess(true);
        setForm({ tipo: 'mejora', descripcion: '' });
        setFile(null);
      } else {
        setErrorMsg(res.error?.message || 'Error al enviar reporte');
      }
    } catch (err) {
      setErrorMsg('Error de red al enviar el reporte');
    }
    setIsSubmitting(false);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-dark mb-2">¡Reporte Enviado con Éxito!</h2>
        <p className="text-muted max-w-md mx-auto mb-6">
          Tu mensaje ha sido notificado al desarrollador. Muchas gracias por ayudarnos a mejorar el sistema.
        </p>
        <button 
          onClick={() => setSuccess(false)}
          className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
        >
          Enviar otro reporte
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 overflow-hidden rounded-[14px] shadow-sm shrink-0 mt-0.5">
            <img src={logo3f} alt="Logo 3F" className="w-full h-full object-cover scale-[1.15]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              Soporte y Comentarios
            </h1>
            <p className="text-muted mt-1">
              Reporta errores, solicita mejoras o déjanos sugerencias.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface rounded-xl shadow-sm border border-border p-6 space-y-6">
        {errorMsg && (
          <div className="p-4 bg-danger/10 text-danger rounded-lg flex items-center gap-2 text-sm font-medium">
            <AlertCircle size={18} />
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-dark mb-2">Tipo de Reporte *</label>
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="mejora">Mejora</option>
            <option value="sugerencia">Sugerencia</option>
            <option value="error">Error del sistema</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark mb-2">Descripción *</label>
          <textarea
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            rows={5}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
            placeholder="Describe detalladamente tu solicitud o el error que experimentaste..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark mb-2">Adjuntar Archivo (Opcional)</label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg cursor-pointer hover:bg-surface transition-colors text-sm font-medium text-dark">
              <FileText size={18} className="text-muted" />
              Seleccionar archivo
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept="image/*,.pdf"
              />
            </label>
            {file && (
              <span className="text-sm text-muted truncate max-w-xs flex-1">
                {file.name}
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-2">Imágenes o PDFs (máx 5MB)</p>
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={18} />
            )}
            Enviar Reporte
          </button>
        </div>
      </form>
    </div>
  );
}
