import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * Toggle accesible de modo claro/oscuro.
 * - Persiste la elección en `localStorage('theme')`.
 * - Si no hay preferencia guardada, respeta `prefers-color-scheme` del SO.
 * - Agrega/quita la clase `dark` en `<html>`.
 */
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark((prev) => !prev)}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className="relative w-10 h-10 flex items-center justify-center rounded-full
                 bg-background border border-border
                 hover:bg-primary/10 hover:border-primary/30
                 transition-all duration-300 cursor-pointer"
    >
      <Sun
        size={20}
        className={`absolute transition-all duration-300 text-amber-500
          ${isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`}
      />
      <Moon
        size={20}
        className={`absolute transition-all duration-300 text-blue-300
          ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`}
      />
    </button>
  );
}
