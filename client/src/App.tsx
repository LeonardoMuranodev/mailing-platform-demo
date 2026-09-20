import { useEffect, useState } from 'react';
import { Routes, Route, useLocation, Link, Navigate } from 'react-router-dom';
import { Mail, BarChart3, Users, Settings, LogOut, UserCircle2, AlertTriangle, LifeBuoy, Menu, X, Github, Linkedin } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-3 min-h-[64px] flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-8">
          
          <div className="flex items-center justify-between w-full lg:w-auto shrink-0">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary hover:text-primary-dark transition-colors">
              <Mail size={24} className="text-primary" />
              <span>GenMailer</span>
            </Link>

            {/* Right side controls on Mobile */}
            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-muted hover:text-dark hover:bg-background rounded-lg transition-colors focus:outline-none"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className={`${isMobileMenuOpen ? 'flex' : 'hidden'} lg:flex flex-col lg:flex-row items-stretch lg:items-center gap-1.5 lg:gap-1 w-full lg:w-auto flex-1 lg:justify-center transition-all duration-300 pb-3 lg:pb-0`}>
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || (link.path === '/' && location.pathname.startsWith('/campanas'));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 lg:px-2.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
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
          <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} lg:flex flex-col lg:flex-row items-stretch lg:items-center lg:justify-end gap-4 border-t lg:border-t-0 border-border pt-4 lg:pt-0 shrink-0`}>
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
            
            {user && (
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:pl-4 lg:border-l lg:border-border">
                <div className="flex items-center gap-2 px-2 lg:px-0">
                  <UserCircle2 size={20} className="text-muted shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold leading-tight">{user.nombre}</span>
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider">{user.rol}</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setShowLogoutModal(true);
                  }}
                  className="flex items-center justify-center gap-2 lg:gap-0 px-3 py-2 lg:p-1.5 text-muted hover:text-danger rounded-lg lg:rounded-md hover:bg-danger/10 bg-background lg:bg-transparent border lg:border-0 border-border transition-colors w-full lg:w-auto text-sm font-medium"
                  title="Cerrar Sesión"
                >
                  <LogOut size={18} />
                  <span className="lg:hidden">Cerrar Sesión</span>
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
          <Route path="/campanas/editar/:id" element={<CrearCampana />} />
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-muted text-sm font-medium">
          <div className="flex items-center gap-1.5">
            <span>Desarrollado por</span>
            <a href="https://github.com/LeonardoMuranodev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold flex items-center gap-1">
              Leonardo Murano
            </a>
          </div>
          <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-border"></div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/LeonardoMuranodev/mailing-platform-demo" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-dark transition-colors" title="Código Fuente en GitHub">
              <Github size={20} />
            </a>
            <a href="https://www.linkedin.com/in/leonardo-murano" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-[#0a66c2] transition-colors" title="Perfil de LinkedIn">
              <Linkedin size={20} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
