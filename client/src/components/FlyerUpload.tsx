import { useCallback, useRef } from 'react';
import { UploadCloud, X, FileImage } from 'lucide-react';
import { useCampanaStore } from '../stores/campanaStore';

export default function FlyerUpload() {
  const flyer = useCampanaStore((state) => state.flyer);
  const flyerPreview = useCampanaStore((state) => state.flyerPreview);
  const setFlyer = useCampanaStore((state) => state.setFlyer);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setFlyer(file);
      } else {
        alert('Por favor seleccioná un archivo de imagen válido.');
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        setFlyer(file);
      } else if (file) {
        alert('Por favor seleccioná un archivo de imagen válido.');
      }
    },
    [setFlyer],
  );

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFlyer(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
      />

      {!flyerPreview ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors group flex flex-col items-center justify-center bg-surface"
        >
          <div className="p-3 bg-background rounded-full group-hover:bg-primary/10 transition-colors mb-4">
            <UploadCloud className="text-muted group-hover:text-primary transition-colors" size={32} />
          </div>
          <p className="text-dark font-medium mb-1">
            Hacé clic o arrastrá tu flyer aquí
          </p>
          <p className="text-muted text-sm">
            PNG, JPG, WEBP hasta 5MB
          </p>
        </div>
      ) : (
        <div className="relative border border-border rounded-lg p-2 bg-surface flex flex-col sm:flex-row items-center gap-4 transition-colors">
          <div className="relative w-full sm:w-48 h-32 bg-background rounded flex-shrink-0 overflow-hidden group">
            <img
              src={flyerPreview}
              alt="Preview del flyer"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded hover:bg-black/70"
              >
                Cambiar
              </button>
            </div>
          </div>
          <div className="flex-grow flex flex-col gap-1 w-full text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-dark font-medium">
              <FileImage size={18} className="text-primary" />
              <span className="truncate max-w-[200px]">{flyer?.name}</span>
            </div>
            <p className="text-muted text-sm">
              {flyer ? (flyer.size / 1024 / 1024).toFixed(2) : 0} MB
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-2 text-slate-400 hover:text-danger hover:bg-danger/10 rounded-full transition-colors absolute top-2 right-2 sm:static"
            title="Quitar flyer"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
