import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 animate-fade-in text-center">
      <div className="w-20 h-20 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-6 shadow-sm">
        <AlertCircle size={40} />
      </div>
      <h1 className="text-6xl font-extrabold text-dark tracking-tight mb-4">404</h1>
      <h2 className="text-2xl font-bold text-dark mb-2">Página no encontrada</h2>
      <p className="text-muted max-w-md mx-auto mb-8">
        La dirección a la que intentás acceder no existe o fue movida.
      </p>
      <Link 
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors shadow-sm hover:shadow-md"
      >
        <Home size={20} />
        Volver al Inicio
      </Link>
    </div>
  );
}
