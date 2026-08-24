import { create } from 'zustand';
import type { AuthUser, Rol } from '../types/auth';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('auth_token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('auth_token'),

  setAuth: (token, user) => {
    localStorage.setItem('auth_token', token);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ token: null, user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        set({ user: data.data.user, isAuthenticated: true });
      } else {
        localStorage.removeItem('auth_token');
        set({ token: null, user: null, isAuthenticated: false });
      }
    } catch (e) {
      console.error('Error verificando sesión', e);
      localStorage.removeItem('auth_token');
      set({ token: null, user: null, isAuthenticated: false });
    }
  }
}));
