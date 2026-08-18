import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Mail } from 'lucide-react';
import ListaCampanas from './components/ListaCampanas';
import DetalleCampana from './components/DetalleCampana';
import CrearCampana from './components/CrearCampana';
import VistaPrevia from './components/VistaPrevia';
import ThemeToggle from './components/ThemeToggle';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-background text-dark transition-colors duration-300">
      {/* ── Navbar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <button
            onClick={() => navigate('/')}
            className={`flex items-center gap-2 font-bold text-lg transition-colors
              ${isHome ? 'text-primary cursor-default' : 'text-dark hover:text-primary cursor-pointer'}`}
          >
            <Mail size={22} className="text-primary" />
            <span className="hidden sm:inline">3F Mailer</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Routes ────────────────────────────────────── */}
      <main>
        <Routes>
          <Route path="/" element={<ListaCampanas />} />
          <Route path="/nueva" element={<CrearCampana />} />
          <Route path="/campanas/:id" element={<DetalleCampana />} />
          <Route path="/preview" element={<VistaPrevia />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
