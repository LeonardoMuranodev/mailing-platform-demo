import { useAuthStore } from '../stores/authStore';

export function usePermisos() {
  const user = useAuthStore(state => state.user);
  
  if (!user) {
    return {
      esDesarrollador: false,
      esEncargada: false,
      esInvitado: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeEliminar: false
    };
  }

  const esDesarrollador = user.rol === 'desarrollador';
  const esEncargada = user.rol === 'encargada';
  const esInvitado = user.rol === 'invitado';

  return {
    esDesarrollador,
    esEncargada,
    esInvitado,
    // La encargada y el desarrollador pueden mutar recursos
    puedeCrear: esDesarrollador || esEncargada,
    puedeEditar: esDesarrollador || esEncargada,
    puedeEliminar: esDesarrollador || esEncargada,
  };
}
