### 📋 Roadmap de Producción: 3F Mailer


#### Fase 3: UX y Frontend (Pulido Visual)

* [x] **Paginación:** Implementar en las vistas de Contactos y Campañas para evitar colapsos de memoria en el navegador.
* [x] **Corrección CSS (Checkboxes/Selects):** Solucionar el padding de los iconos en listas desplegables y checkboxes.
* [] **Refactor Visual Global:** Cambiar logo sin fondo, ajustar el `max-width` (ej: `max-w-6xl`) para mejor lectura en notebooks y refinar el CSS.
* [x] **Responsive Design:** Asegurar que las tablas y modales sean usables en resoluciones móviles/tablets.
* [x] **Actualización de Meta/Title:** Cambiar title y favicon de la página en `index.html`.

#### Fase 5: DevOps y Despliegue (Go-Live)

* [x] **Testing:** Escribir y ejecutar pruebas para los flujos críticos (Login, Poblar Cola, Rotación SMTP).
* [x] **Optimización de Recursos:** Revisar el tamaño de la imagen Docker final y limpiar logs innecesarios.
* [] **Despliegue Final:** Subir al repositorio Git corporativo (con VPN) y levantar el `docker-compose.yml` en el servidor de producción. Ya tengo el dominio disponible, tengo que configurar todo eso.
* [] **Importar los contactos de la base de datos de Google Sheets:** al sistema

Checklist para el Paso a Producción 🚀
Una vez que hagas tus pruebas de envío y estés satisfecho, esto es lo que debés tener en cuenta para pasarlo a producción con un dominio real:

Dominio y HTTPS (SSL):
El docker-compose.prod.yml que armamos levanta la app en el puerto 80. Una vez que le apuntes el dominio en tu servidor VPS, deberás instalar Certbot (Let's Encrypt) para tener el candadito verde (HTTPS). Es fundamental porque navegadores modernos y proveedores de correo bloquean links HTTP sin seguridad.
Variable PUBLIC_API_URL:
En tu archivo .env del servidor de producción, acordate de cambiar esta variable (y en el front VITE_API_BASE_URL) para que apunte a tu nuevo dominio (https://tu-dominio.com), así el Tracking de clicks/aperturas se genera con las URLs correctas.
Credenciales Finales de Google Drive y Sheets:
Si vas a usar cuentas definitivas distintas a las de desarrollo, recordá actualizar los Tokens de GDrive y el email de la Service Account en el servidor.
Warm-up de cuentas SMTP (Opcional pero recomendado):
Cuando pases a producción real, tratá de no disparar 500 mails de golpe el primer día si las cuentas de Gmail son muy nuevas. El sistema ya tiene sleeps y rotación para evitar el spam, pero Gmail evalúa la reputación del remitente.
¡Vía libre para testear campañas! Mandá una campaña de prueba a un par de correos tuyos y fijate que los contadores de aperturas y clicks sumen bien en el dashboard. ¡Cualquier cosa acá estoy para los detalles finos!