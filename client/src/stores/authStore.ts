import { create } from 'zustand';
import type { AuthUser } from '../types/auth';
import { cerrarSesionApi } from '../services/api';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('auth_token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('auth_token'),

  setAuth: (token, user) => {
    if (token) {
      try {
        localStorage.setItem('auth_token', token);
      } catch {}
    }
    set({ token, user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await cerrarSesionApi();
    } catch (e) {
      console.warn('Error al llamar al endpoint de logout:', e);
    } finally {
      localStorage.removeItem('auth_token');
      set({ token: null, user: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers,
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (res.ok && data.success && data.data?.user) {
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
