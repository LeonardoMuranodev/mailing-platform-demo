FRONTEND:

General:
- Cambiar title de la pagina y logo tambien
- Cambiar logo general por el de 3 de febero sin fondo que me paso Matias
- El ancho total de la pantalla me parece bastante grande, deberiamos achicarlo un poco, por lo menos en la notebook que tengo, tengo que recorrer bastante con los ojos. Tampoco excederse en el achique

Nueva vista: Directorio de Contactos
    - Error de padding en la lista desplegable de rubros y Estado, el icono de la fecha deberia estar mas a la izquierda.

Nueva Seccion: soporte/
- No lo tengo definido, pero que la encargadas puedan darme tips, mejoraas o reportar errores del sistema. Un formulario que tenga algunos tipos predefinidos. Asi mas adelante cuando implementemos el tema de los roles, yo como Desarrollador puedo ver las tareas pendientes o lo que ellas escribieron para implementar por prioridad.
Que tenga como minimo: Tipo (mejora, sugerencia, error), Descripcion (textArea),Adjuntar no obligatorio (imagen, pdf, etc.).
TIene que guardarse en el sistema, pero ademas mandarme un mail y / o telegram, el cual debe configurarse tambien desde el rol de desaroollador. Al mandar el form, un modal de confirmacion de que envio el reporte (ok!) al desarrollador.

## 2. Nuevo Backend: Sistema de Logueo basado en roles:
- [x] Crear tabla `usuarios` (id, nombre, email, password_hash, rol).
- [x] Tipos: `Usuario`, `Rol` ('desarrollador', 'encargada', 'invitado').
- [x] Instalar dependencias: `bcrypt`, `jsonwebtoken`.
- [x] Seed: Crear usuario "desarrollador" por defecto.
- [x] Endpoints Auth: `/api/auth/login` y `/api/auth/me`.
- [x] Middlewares: `requireAuth` (verifica JWT) y `requireRole` (protege rutas de mutación).
- [x] Proteger rutas de mutación en todos los routers (`/campanas`, `/contactos`, `/smtp`, etc.).

## 3. Frontend: Pantalla de Logueo y Persistencia
- [x] Tipos: `client/src/types/auth.ts`
- [x] Store: `client/src/stores/authStore.ts` (Zustand) para manejar `token` y `user` actual.
- [x] Modificar `api.ts`: inyectar token en headers + auto-logout en 401.
- [x] Componente: `client/src/components/Login.tsx` (vista con diseño moderno).
- [x] Hook: `client/src/hooks/usePermisos.ts` para abstraer permisos (`puedeCrear`, `puedeEliminar`).
- [x] Modificar `App.tsx`: gate de login + navbar con info de usuario y botón de salir.
- [x] Modificar `ListaCampanas.tsx`: ocultar botón "Nueva Campaña" si es invitado.
- [x] Modificar `CuentasSmtp.tsx`: ocultar "Conectar Cuenta", Editar, Eliminar y toggle si es invitado.
- [x] Modificar `DirectorioContactos.tsx`: ocultar "Crear Contacto", "Importar", Edit, Eliminar si es invitado.