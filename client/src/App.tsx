import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, BarChart3, Users, Settings } from 'lucide-react';
import ListaCampanas from './components/ListaCampanas';
import DetalleCampana from './components/DetalleCampana';
import CrearCampana from './components/CrearCampana';
import VistaPrevia from './components/VistaPrevia';
import EstadisticasGenerales from './components/EstadisticasGenerales';
import ThemeToggle from './components/ThemeToggle';

function App() {
  const location = useLocation();

  const navLinks = [
    { path: '/', label: 'Campañas', icon: <Mail size={18} /> },
    { path: '/estadisticas', label: 'Estadísticas', icon: <BarChart3 size={18} /> },
    { path: '/contactos', label: 'Contactos', icon: <Users size={18} /> },
    { path: '/cuentas', label: 'Cuentas SMTP', icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-dark transition-colors duration-300">
      {/* ── Navbar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 sm:h-16 gap-4 sm:gap-0">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary hover:text-primary-dark transition-colors shrink-0">
            <Mail size={24} className="text-primary" />
            <span className="hidden sm:inline">3F Mailer</span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || (link.path === '/' && location.pathname.startsWith('/campanas'));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                    ${isActive 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-muted hover:bg-background hover:text-dark'
                    }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="shrink-0 hidden sm:block">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Routes ────────────────────────────────────── */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<ListaCampanas />} />
          <Route path="/nueva" element={<CrearCampana />} />
          <Route path="/campanas/:id" element={<DetalleCampana />} />
          <Route path="/preview" element={<VistaPrevia />} />
          <Route path="/estadisticas" element={<EstadisticasGenerales />} />
        </Routes>
      </main>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="border-t border-border mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-muted text-sm font-medium">
          Desarrollado por el equipo de Tecno 3F
        </div>
      </footer>
    </div>
  );
}

export default App;
