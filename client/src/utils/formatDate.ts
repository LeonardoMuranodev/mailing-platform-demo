/**
 * Formatea una fecha en formato YYYY-MM-DD a un string legible en español.
 * Ejemplo: "2026-09-01" -> "1 de septiembre de 2026"
 */
export function formatDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const [year, month, day] = dateString.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      
      return date.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  }
