import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, useLocation, Link, Navigate, useNavigate } from 'react-router-dom';
import { Mail, BarChart3, Users, Settings, LogOut, UserCircle2, AlertTriangle, LifeBuoy, Menu, X, ChevronDown, Clock, ShieldAlert } from 'lucide-react';
import { useAuthStore } from './stores/authStore';
import { useNotificationStore } from './stores/useNotificationStore';
import { GeminiNotificationContainer } from './components/GeminiNotificationContainer';
import { NotificationBell } from './components/NotificationBell';
import Login from './components/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Perfil from './pages/Perfil';
import ListaCampanas from './components/ListaCampanas';
import DetalleCampana from './components/DetalleCampana';
import CrearCampana from './components/CrearCampana';
import VistaPrevia from './components/VistaPrevia';
import EstadisticasGenerales from './components/EstadisticasGenerales';
import CuentasSmtp from './components/CuentasSmtp';
import DirectorioContactos from './components/DirectorioContactos';
import GestionUsuarios from './components/GestionUsuarios';
import Soporte from './components/Soporte';
import HorariosSmtp from './components/HorariosSmtp';
import ThemeToggle from './components/ThemeToggle';
import NotFound from './components/NotFound';
import Auditoria from './pages/Auditoria';
function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, token, checkAuth, logout } = useAuthStore();
  const { conectarSSE, desconectarSSE, setNavegarCallback } = useNotificationStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Bloquear scroll del fondo cuando hay modal abierto
  useEffect(() => {
    if (showLogoutModal) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [showLogoutModal]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    setNavegarCallback((url: string) => navigate(url));
  }, [navigate, setNavegarCallback]);

  useEffect(() => {
    if (isAuthenticated && token) {
      conectarSSE(token);
    } else {
      desconectarSSE();
    }
    return () => {
      desconectarSSE();
    };
  }, [isAuthenticated, token, conectarSSE, desconectarSSE]);

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  interface NavItem {
    path: string;
    label: React.ReactNode;
    icon: React.ReactNode;
  }

  const navLinks: NavItem[] = [
    { path: '/', label: 'Campañas', icon: <Mail size={16} className="shrink-0" /> },
    { path: '/estadisticas', label: 'Estadísticas', icon: <BarChart3 size={16} className="shrink-0" /> },
    { path: '/contactos', label: 'Contactos', icon: <Users size={16} className="shrink-0" /> },
    { 
      path: '/cuentas', 
      label: (
        <>
          Cuentas<span className="inline lg:hidden xl:inline">&nbsp;SMTP</span>
        </>
      ), 
      icon: <Settings size={16} className="shrink-0" /> 
    },
  ];

  if (user?.rol === 'desarrollador' || user?.rol === 'encargada') {
    navLinks.push({ 
      path: '/horarios', 
      label: (
        <>
          Horarios<span className="inline lg:hidden xl:inline">&nbsp;SMTP</span>
        </>
      ), 
      icon: <Clock size={16} className="shrink-0" /> 
    });
  }

  if (user?.rol === 'desarrollador') {
    navLinks.push({ path: '/usuarios', label: 'Usuarios', icon: <UserCircle2 size={16} className="shrink-0" /> });
    navLinks.push({ path: '/auditoria', label: 'Auditoría', icon: <ShieldAlert size={16} className="shrink-0" /> });
  }

  // Soporte siempre al final
  navLinks.push({ path: '/soporte', label: 'Soporte', icon: <LifeBuoy size={16} className="shrink-0" /> });

  return (
    <div className="min-h-screen flex flex-col bg-background text-dark transition-colors duration-300 overflow-x-hidden">
      {/* ── Navbar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border transition-colors duration-300 overflow-x-clip">
        <div className="w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-3 xl:px-6 py-2.5 lg:py-2 min-h-[60px] flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-2 xl:gap-4">
          
          <div className="flex items-center justify-between w-full lg:w-auto shrink-0">
            {/* Logo */}
            <Link 
              to="/" 
              onClick={() => setIsMobileMenuOpen(false)} 
              className="flex items-center gap-2 font-bold text-base xl:text-lg text-primary hover:text-primary-dark transition-colors shrink-0"
            >
              <Mail size={22} className="text-primary shrink-0" />
              <span>GenMailer</span>
            </Link>

            {/* Right side controls on Mobile */}
            <div className="flex items-center gap-1 lg:hidden">
              <NotificationBell />
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
          <nav className={`${isMobileMenuOpen ? 'flex' : 'hidden'} lg:flex flex-col lg:flex-row items-stretch lg:items-center gap-1 lg:gap-0.5 xl:gap-1 w-full lg:w-auto flex-1 lg:justify-center transition-all duration-300 pb-3 lg:pb-0 min-w-0`}>
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path || (link.path === '/' && location.pathname.startsWith('/campanas'));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-1.5 lg:gap-1 xl:gap-1.5 px-3 lg:px-1.5 xl:px-2.5 py-2 lg:py-1.5 rounded-lg text-sm lg:text-xs xl:text-sm font-medium transition-colors whitespace-nowrap
                    ${isActive 
                      ? 'bg-primary/10 text-primary font-semibold' 
                      : 'text-muted hover:bg-background hover:text-dark'
                    }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} lg:flex flex-col lg:flex-row items-stretch lg:items-center lg:justify-end gap-3 lg:gap-1.5 xl:gap-3 border-t lg:border-t-0 border-border pt-4 lg:pt-0 shrink-0`}>
            <div className="hidden lg:flex items-center gap-1 xl:gap-1.5">
              <NotificationBell />
              <ThemeToggle />
            </div>
            
            {user && (
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-1.5 xl:gap-2.5 lg:pl-2 xl:pl-3.5 lg:border-l lg:border-border">
                <Link 
                  to="/perfil" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-1.5 xl:gap-2 px-2 xl:px-3 py-1.5 rounded-lg border border-transparent hover:border-border hover:bg-surface transition-all"
                >
                  <UserCircle2 size={18} className="text-muted shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs xl:text-sm font-semibold leading-tight text-dark max-w-[80px] xl:max-w-[130px] 2xl:max-w-none truncate">{user.nombre}</span>
                    <span className="text-[9px] xl:text-[10px] uppercase font-bold text-primary tracking-wider">{user.rol}</span>
                  </div>
                  <ChevronDown size={14} className="text-muted ml-0.5 opacity-50 hidden sm:block shrink-0" />
                </Link>
                <button 
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setShowLogoutModal(true);
                  }}
                  className="flex items-center justify-center gap-2 lg:gap-0 px-3 py-2 lg:p-1.5 text-muted hover:text-danger rounded-lg lg:rounded-md hover:bg-danger/10 bg-background lg:bg-transparent border lg:border-0 border-border transition-colors w-full lg:w-auto text-sm font-medium"
                  title="Cerrar Sesión"
                >
                  <LogOut size={17} />
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
          <Route 
            path="/horarios" 
            element={user?.rol === 'desarrollador' || user?.rol === 'encargada' ? <HorariosSmtp /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/auditoria" 
            element={user?.rol === 'desarrollador' ? <Auditoria /> : <Navigate to="/" replace />} 
          />
          <Route path="/soporte" element={<Soporte />} />
          <Route path="/perfil" element={<Perfil />} />
          
          {/* Prevent authenticated users from accessing login/recovery routes */}
          <Route path="/forgot-password" element={<Navigate to="/" replace />} />
          <Route path="/reset-password" element={<Navigate to="/" replace />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* ── Logout Modal ───────────────────────────────── */}
      {showLogoutModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm p-6 border border-border text-center animate-modal-pop">
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
        </div>,
        document.body
      )}

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="border-t border-border mt-auto py-6 no-print">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 text-center text-muted text-sm font-medium">
          Plataforma de Mailing y Gestión de Campañas
        </div>
      </footer>

      {/* ── Notificaciones Flotantes Estilo Gemini ─────────── */}
      <GeminiNotificationContainer />
    </div>
  );
}

export default App;
