import { useEffect, useState } from 'react';
import { Routes, Route, useLocation, Link, Navigate } from 'react-router-dom';
import { Mail, BarChart3, Users, Settings, LogOut, UserCircle2, AlertTriangle, LifeBuoy } from 'lucide-react';
import { useAuthStore } from './stores/authStore';
import Login from './components/Login';
import ListaCampanas from './components/ListaCampanas';
import DetalleCampana from './components/DetalleCampana';
import CrearCampana from './components/CrearCampana';
import VistaPrevia from './components/VistaPrevia';
import EstadisticasGenerales from './components/EstadisticasGenerales';
import CuentasSmtp from './components/CuentasSmtp';
import DirectorioContactos from './components/DirectorioContactos';
import GestionUsuarios from './components/GestionUsuarios';
import Soporte from './components/Soporte';
import ThemeToggle from './components/ThemeToggle';
import NotFound from './components/NotFound';

function App() {
  const location = useLocation();
  const { isAuthenticated, user, checkAuth, logout } = useAuthStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (!isAuthenticated) {
    return <Login />;
  }

  const navLinks = [
    { path: '/', label: 'Campañas', icon: <Mail size={18} /> },
    { path: '/estadisticas', label: 'Estadísticas', icon: <BarChart3 size={18} /> },
    { path: '/contactos', label: 'Contactos', icon: <Users size={18} /> },
    { path: '/cuentas', label: 'Cuentas SMTP', icon: <Settings size={18} /> },
    { path: '/soporte', label: 'Soporte', icon: <LifeBuoy size={18} /> },
  ];

  if (user?.rol === 'desarrollador') {
    // Reemplaza o agrega el menú de Usuarios. El usuario pidió mantener el ícono de usuarios para contactos y usar otro, o cambiar el de contactos.
    // Lo más simple: mantener Users para contactos, y usar UserCircle2 o Cog/Users para el de Usuarios.
    navLinks.push({ path: '/usuarios', label: 'Usuarios', icon: <Settings size={18} /> });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-dark transition-colors duration-300">
      {/* ── Navbar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border transition-colors duration-300">
        <div className="w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between px-4 sm:px-6 py-3 min-h-[64px] gap-4 lg:gap-8">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary hover:text-primary-dark transition-colors shrink-0">
            <Mail size={24} className="text-primary" />
            <span className="hidden sm:inline">3F Mailer</span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 w-full lg:w-auto flex-1 lg:justify-center scrollbar-hide">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || (link.path === '/' && location.pathname.startsWith('/campanas'));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
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
          <div className="shrink-0 flex items-center justify-end gap-3 hidden sm:flex">
            <ThemeToggle />
            
            {user && (
              <div className="flex items-center gap-3 pl-4 border-l border-border">
                <div className="flex items-center gap-2">
                  <UserCircle2 size={20} className="text-muted" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold leading-tight">{user.nombre}</span>
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider">{user.rol}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLogoutModal(true)}
                  className="p-1.5 text-muted hover:text-danger rounded-md hover:bg-danger/10 transition-colors"
                  title="Cerrar Sesión"
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
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
          <Route path="/cuentas" element={<CuentasSmtp />} />
          <Route path="/contactos" element={<DirectorioContactos />} />
          <Route 
            path="/usuarios" 
            element={user?.rol === 'desarrollador' ? <GestionUsuarios /> : <Navigate to="/" replace />} 
          />
          <Route path="/soporte" element={<Soporte />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* ── Logout Modal ───────────────────────────────── */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm p-6 border border-border text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-warning/10 mb-4">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <h3 className="text-lg font-semibold text-dark mb-2">¿Cerrar sesión?</h3>
            <p className="text-sm text-muted mb-6">
              Estás a punto de salir del sistema. Tendrás que volver a ingresar tus credenciales para acceder.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 text-sm font-medium text-dark bg-background border border-border rounded-lg hover:bg-surface transition-colors w-full"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors w-full"
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="border-t border-border mt-auto py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-muted text-sm font-medium">
          Desarrollado por el equipo de Tecno 3F
        </div>
      </footer>
    </div>
  );
}

export default App;
