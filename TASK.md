### 📋 Roadmap de Producción: 3F Mailer

#### Fase 1: El Motor (Core Business & Entregabilidad)

* [x] **Lógica de envío y rotación SMTP (Round-Robin):** Testear exhaustivamente la asignación de cuentas, respeto de límites diarios y actualización de estados (`enviado` / `fallido`).
* [x] **Link de desuscripción y manejo de rebotes:** *(Omitido según respuesta del usuario)*.
* [x] **Verificación DNS (SPF / DKIM / DMARC):** Validar la salud del dominio emisor para evitar caer en spam.
* [x] **Aviso de campaña terminada:** Reutilizar flujo de n8n para notificar (Email/Telegram) cuando la `cola_envios` quede sin registros pendientes.

#### Fase 2: Seguridad y Estabilidad (Hardening)

* [ x ] **Auditoría de Seguridad:** Sanitización estricta del HTML (DOMPurify) y prevención de inyecciones SQL en todo el sistema.
* [ x ] **Rate Limiting:** Implementar limitadores de peticiones en Express.
* [ x ] **Avisos de error globales por Telegram:** Configurar un webhook/bot que capture crashes de Node.js o caídas de BD (similar a tu nodo "On Error" en n8n).
* [ x ] **Estrategia de Backups automatizada:** Volcado regular de la base de datos de PostgreSQL.
* [ x ] **Backups en Google Drive:**
* [x] **Auditoría de Seguridad:** Sanitización estricta del HTML (DOMPurify) y prevención de inyecciones SQL en todo el sistema.
* [x] **Rate Limiting:** Implementar limitadores de peticiones en Express.
* [x] **Avisos de error globales por Telegram:** Configurar un webhook/bot que capture crashes de Node.js o caídas de BD (similar a tu nodo "On Error" en n8n).
* [x] **Estrategia de Backups automatizada:** Volcado regular de la base de datos de PostgreSQL.
* [x] **Backups en Google Drive:**

#### Fase 3: UX y Frontend (Pulido Visual)

* [x] **Paginación:** Implementar en las vistas de Contactos y Campañas para evitar colapsos de memoria en el navegador.
* [x] **Corrección CSS (Checkboxes/Selects):** Solucionar el padding de los iconos en listas desplegables y checkboxes.
* [x] **Refactor Visual Global:** Cambiar logo sin fondo, ajustar el `max-width` (ej: `max-w-6xl`) para mejor lectura en notebooks y refinar el CSS.
* [x] **Responsive Design:** Asegurar que las tablas y modales sean usables en resoluciones móviles/tablets.
* [x] **Actualización de Meta/Title:** Cambiar title y favicon de la página en `index.html`.

#### Fase 4: Cache (redis)

* [x] **Implementar redis:** para cachear las consultas a la base de datos. Las mas importantes
* [x] **Probar redis:**: Probar tiempos de respuesta , mostrando la diferencia entre sin / con redis

#### Fase 5: DevOps y Despliegue (Go-Live)

* [x] **Testing:** Escribir y ejecutar pruebas para los flujos críticos (Login, Poblar Cola, Rotación SMTP).
* [x] **Optimización de Recursos:** Revisar el tamaño de la imagen Docker final y limpiar logs innecesarios.
* [] **Despliegue Final:** Subir al repositorio Git corporativo (con VPN) y levantar el `docker-compose.yml` en el servidor de producción.
* [] **Importar los contactos de la base de datos de Google Sheets:** al sistema

---

### 🧠 Refresh Arquitectónico: Conceptos Clave

Para que tengas el mapa mental claro al momento de implementar, aquí está la lógica detrás de los puntos críticos:

#### 1. Rotación de Cuentas SMTP (Round-Robin)

El objetivo es "diluir" el volumen de envíos para que Google no bloquee las cuentas por ráfagas de spam.

* **Lógica SQL:** Cuando el worker necesita enviar un correo, el backend ejecuta una consulta que busca cuentas donde `estado = 'activo'` y `enviados_hoy < limite_diario` (ej. 400).
* **El truco (Round-Robin):** Se ordena la consulta por `ultimo_uso ASC NULLS FIRST LIMIT 1`. Esto garantiza que el sistema siempre elija la cuenta que ha estado "descansando" por más tiempo.
* **Circuit Breaker:** Si la cuenta alcanza su límite diario, el sistema actualiza automáticamente su estado a `agotado`, sacándola de la rotación hasta el reseteo del día siguiente.

#### 2. Entregabilidad y DNS (SPF, DKIM, DMARC)

Si envías desde `@gmail.com` nativo, Google ya firma los correos. Pero si en el futuro conectas un dominio personalizado del municipio (ej. `@tresdefebrero.gov.ar`) usando Google Workspace o un SMTP transaccional (SendGrid, AWS SES), enviar un correo sin estos registros es un viaje directo a la carpeta de SPAM.

* **SPF:** Dice qué IPs están autorizadas a enviar correos en nombre de tu dominio.
* **DKIM:** Es una firma criptográfica oculta en el correo que garantiza que no fue alterado en el camino.

#### 3. Rate Limiting (Defensa contra Bots)

Tu API actualmente está expuesta. Si un bot ataca el endpoint de `/api/auth/login` probando miles de contraseñas, o ataca el endpoint de `/api/queue/poblar`, puede tirar el servidor o saturar la base de datos.

* **Solución:** Se implementa un middleware en Express (como `express-rate-limit`). Se configura, por ejemplo, para que una misma IP solo pueda intentar loguearse 5 veces por minuto. Si se excede, el servidor devuelve un error `HTTP 429 (Too Many Requests)`.

#### 4. Estrategia de Backups (Dump Automatizado)

Si bien la base de datos tiene persistencia en volúmenes Docker, si el servidor físico sufre un fallo irrecuperable o alguien hace un `DROP TABLE` por error, pierdes todo el directorio.

* **Solución n8n-Native:** Puedes armar un flujo en tu instancia de n8n con un *Cron Trigger* (ej. todos los días a las 3 AM) que ejecute un *Execute Command* corriendo `pg_dump` directo al contenedor de PostgreSQL, y luego tome ese archivo `.sql` y lo suba mediante un nodo a Google Drive o S3. Es 100% automatizado y fuera del servidor principal.