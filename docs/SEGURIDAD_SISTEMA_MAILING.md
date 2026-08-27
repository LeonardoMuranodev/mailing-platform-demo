# Checklist de Seguridad — Sistema de Mailing (React + Node TS + PostgreSQL/Supabase + Redis)

> Documento para auditar y reforzar la seguridad de la aplicación antes de producción.
> Contexto: sistema de campañas de email, envío automático round-robin con 5 cuentas, autenticación JWT por roles, ABM de contactos, estadísticas y seguimiento de campañas.

---

## 1. Autenticación y JWT

- [ ] **Access token de vida corta** (10-15 min) + **refresh token** de vida más larga (7-30 días), nunca un solo token de larga duración.
- [ ] Refresh tokens **rotativos**: cada uso genera uno nuevo e invalida el anterior (rotation + reuse detection). Si se detecta reuso de un refresh token ya invalidado, revocar toda la sesión del usuario.
- [ ] Guardar el JWT en **cookie `httpOnly`, `secure`, `sameSite=strict/lax`**, no en `localStorage` (evita robo por XSS).
- [ ] Firmar con algoritmo asimétrico (**RS256/ES256**) en vez de HS256 si hay múltiples servicios validando tokens; si usás HS256, el secreto debe ser largo (≥256 bits) y rotable.
- [ ] Verificar **siempre** `alg`, `iss`, `aud` y `exp` al validar el token (evitar el ataque de "alg: none").
- [ ] Incluir un **`jti` (token ID)** y mantener una blacklist/whitelist en Redis para poder revocar tokens específicos (logout, cambio de contraseña, ban de usuario).
- [ ] Endpoint de **logout real** que invalide el refresh token (no solo borrar la cookie del cliente).
- [ ] **Rate limit** en `/login` y `/refresh` (ej. 5 intentos cada 15 min por IP + usuario) para frenar fuerza bruta.
- [ ] **Lockout progresivo** de cuenta tras N intentos fallidos, con notificación al usuario.
- [ ] Contraseñas con **bcrypt/argon2** (nunca SHA256/MD5), costo adecuado (bcrypt rounds ≥ 12, o argon2id).
- [ ] Política de contraseñas mínima (longitud, no reutilizar últimas N) — mejor aún, sugerir **2FA** para la cuenta de la "encargada"/admin.
- [ ] Endpoint de **cambio de contraseña** invalida todos los refresh tokens activos salvo la sesión actual.

## 2. Autorización y Roles (RBAC)

- [ ] La autorización se valida **siempre en el backend**, nunca confiar en lo que oculta/muestra el frontend (esconder un botón no es seguridad).
- [ ] Middleware centralizado que verifique rol/permiso en **cada** endpoint, no solo en las rutas "sensibles" obvias.
- [ ] Revisar **IDOR** (Insecure Direct Object Reference): que un usuario no pueda acceder a contactos/campañas/estadísticas de otra empresa/cliente cambiando un `id` en la URL o el body. Validar ownership (`campaign.owner_id === req.user.id` o pertenencia a la organización) en cada consulta.
- [ ] Principio de mínimo privilegio: el rol "invitado" no debería poder, por ejemplo, gestionar usuarios o ver credenciales de las 5 cuentas de envío si no le corresponde.
- [ ] Auditar acciones sensibles: quién creó/editó/eliminó una campaña, quién exportó contactos, etc. (ver sección de logging).

## 3. Validación y sanitización de entradas

- [ ] Ya cubriste SQL injection — reforzar igual con **queries parametrizadas / ORM (Prisma, Knex, Supabase client)** en el 100% del código, sin concatenar strings en ningún lado (incluso en reportes o filtros dinámicos).
- [ ] Validar **todo** input con una librería de schema (Zod, Yup, Joi) tanto en frontend (UX) como **obligatoriamente en backend** (seguridad real).
- [ ] Sanitizar el **HTML de las campañas de email** (el editor de la encargada) contra XSS: usar una librería como `DOMPurify` (server-side con `jsdom`) antes de guardar/enviar el HTML. Esto es crítico porque el contenido después se renderiza en el navegador del destinatario Y potencialmente en el panel de preview de tu app.
- [ ] Cuidado con **XSS almacenado** en nombres de contacto, asuntos de campaña, campos personalizados (`{{nombre}}`) que luego se muestran en el dashboard.
- [ ] Escapar variables de **template merge** (personalización de mails) para que un contacto no pueda inyectar HTML/JS malicioso vía un campo tipo "empresa" o "nombre" que termine en el mail o en el dashboard de otro usuario.
- [ ] Validar tipo, tamaño y contenido real (magic bytes) de cualquier archivo subido (ej. CSV de contactos, adjuntos) — no confiar en la extensión ni el `Content-Type` declarado.
- [ ] Límite de tamaño en payloads (`body-parser`/`express.json({ limit: '1mb' })`) para evitar DoS por payloads gigantes.

## 4. Rate Limiting y anti-abuso

- [ ] Rate limiting por IP y por usuario en **todos** los endpoints públicos, no solo login (usar `express-rate-limit` + store en Redis para que funcione con múltiples instancias).
- [ ] Rate limiting específico en endpoints de **envío de campañas** y **creación masiva de contactos** para evitar que una cuenta comprometida spamee o dispare miles de envíos.
- [ ] Protección **CAPTCHA** (hCaptcha/reCAPTCHA) en formularios públicos si los hay (ej. suscripción/baja pública).
- [ ] Límite de **exportación de contactos** (throttling) para dificultar la exfiltración masiva de la base de datos si una cuenta se compromete.

## 5. Seguridad de la Base de Datos (Postgres / Supabase)

- [ ] **Row Level Security (RLS)** activado en Supabase para todas las tablas con datos sensibles (contactos, campañas, estadísticas), no depender solo de la lógica del backend.
- [ ] Usar la **service role key** de Supabase únicamente en el backend (server-side), **nunca** exponerla al frontend. El frontend debe usar la `anon key` + RLS.
- [ ] Conexión a la base con **SSL/TLS obligatorio** (`sslmode=require`).
- [ ] Usuario de base de datos de la aplicación con **permisos mínimos** (no usar el superusuario/owner para las queries de la app).
- [ ] Backups automáticos + prueba periódica de restore (un backup que nunca probaste restaurar no sirve).
- [ ] Encriptar en reposo columnas especialmente sensibles si aplica (tokens de las 5 cuentas de envío, API keys de proveedores SMTP) usando `pgcrypto` o cifrado a nivel de aplicación (AES-256), nunca guardarlas en texto plano.
- [ ] Índices y constraints (`UNIQUE`, `CHECK`) a nivel de DB como última barrera, no solo validación en aplicación.

## 6. Seguridad de Redis

- [ ] Redis **no expuesto a internet**: bind solo a red interna/VPC, o con `requirepass`/ACL si es necesario acceso remoto.
- [ ] Habilitar **autenticación** (`requirepass` o Redis ACL con usuarios/permisos granulares) y TLS si el proveedor lo soporta.
- [ ] Si Redis se usa para colas de envío (round robin) o rate limiting, cuidar que no se puedan **envenenar las claves** desde inputs de usuario sin sanitizar (ej. armar keys con `contactId` sin escapar).
- [ ] Definir `maxmemory-policy` adecuada y monitorear para evitar que una cola descontrolada tire el servicio.
- [ ] No guardar información sensible en claro en Redis (tokens, contraseñas) sin cifrado si hay riesgo de acceso no autorizado.

## 7. Seguridad específica de Email / Anti-Spam / Compliance

Esto es particular a tu dominio y muy importante para no terminar **blacklisteado**:

- [ ] **SPF, DKIM y DMARC** configurados correctamente para cada uno de los 5 dominios/cuentas de envío. Sin esto los mails caen en spam o rebotan.
- [ ] **Warm-up gradual** de las 5 cuentas nuevas (no empezar enviando miles de mails de una).
- [ ] Manejo de **bounces** (hard/soft) y **quejas de spam** (feedback loop) para sacar automáticamente contactos problemáticos y proteger la reputación de las cuentas.
- [ ] **Link de baja (unsubscribe) obligatorio** y funcional en cada campaña, procesado automáticamente (requerido por ley en Argentina — Ley 25.326 de Protección de Datos Personales — y por las políticas anti-spam de Google/Microsoft).
- [ ] Doble opt-in recomendado para nuevos contactos si la captación no es 100% consentida explícitamente.
- [ ] **Rotación/monitoreo del algoritmo round robin**: si una de las 5 cuentas empieza a tener muchos bounces/quejas, sacarla automáticamente de la rotación en vez de seguir usándola (protege la reputación de las otras 4).
- [ ] Credenciales SMTP/API de las 5 cuentas guardadas como **secrets cifrados**, nunca hardcodeadas ni en el repo.
- [ ] Firmar los **webhooks entrantes** de tu proveedor de email (SendGrid, Mailgun, SES, etc. — verificar bounces/opens/clicks) validando la firma/secreto del webhook para que nadie pueda falsificar eventos.
- [ ] Registrar consentimiento de cada contacto (fecha, origen, IP si aplica) para poder demostrar compliance ante una auditoría o reclamo.

## 8. Seguridad de API / HTTP

- [ ] **CORS** restringido: `origin` explícito (tu dominio del front), no `*`, especialmente si usás cookies con credentials.
- [ ] **Helmet.js** (o equivalente) para headers de seguridad: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (HSTS).
- [ ] Protección **CSRF** si usás cookies para auth (token CSRF o `SameSite=Strict`, doble verificación en mutaciones).
- [ ] Todo el tráfico exclusivamente por **HTTPS** (redirigir HTTP → HTTPS, HSTS con `includeSubDomains`).
- [ ] No exponer **stack traces** ni mensajes de error internos al cliente en producción (`NODE_ENV=production`, manejador de errores genérico).
- [ ] Ocultar headers que delatan tecnología (`X-Powered-By: Express` desactivado).
- [ ] Versionado de API y deprecar endpoints viejos en vez de dejarlos vivos sin mantenimiento.

## 9. Gestión de secretos

- [ ] Variables sensibles (JWT secret, DB URL, Redis password, API keys de email, Supabase service key) **solo en variables de entorno**, nunca commiteadas al repo.
- [ ] `.env` en `.gitignore` (verificar que nunca se subió por error — revisar historial de git con herramientas como `git-secrets` o `trufflehog`).
- [ ] Usar un **vault/secret manager** (Supabase Vault, AWS Secrets Manager, Doppler, etc.) en vez de `.env` planos en el servidor de producción si es posible.
- [ ] Rotación periódica de secretos (JWT secret, API keys) y plan de revocación rápida ante una fuga.

## 10. Logging, monitoreo y auditoría

- [ ] Log de eventos de seguridad: logins fallidos, cambios de permisos, exportación de contactos, envío de campañas, cambios de contraseña.
- [ ] **Nunca loguear** contraseñas, tokens completos, ni contenido sensible de contactos en texto plano.
- [ ] Alertas automáticas ante patrones anómalos (ej. 1000 contactos exportados en 1 minuto, muchos 401/403 seguidos, envío masivo fuera de horario habitual).
- [ ] Monitoreo de dependencias con **Sentry** (errores) y algo de APM si el volumen lo justifica.
- [ ] Logs centralizados con retención definida (y considerar que los logs también son datos personales si incluyen emails — aplicar política de retención/anonimización).

## 11. Protección de datos personales (Ley 25.326 / GDPR si aplica a clientes UE)

- [ ] Minimizar datos guardados de cada contacto a lo estrictamente necesario.
- [ ] Endpoint/proceso para **derecho de acceso, rectificación y baja** (ARCO) de un contacto, no solo el unsubscribe de marketing.
- [ ] Cifrado en tránsito (TLS) y en reposo para datos personales.
- [ ] Definir política de retención: eliminar/anonimizar contactos inactivos o que pidieron baja después de X tiempo.
- [ ] Si hay clientes/contactos en la UE, revisar aplicabilidad de GDPR (base legal de tratamiento, DPA con proveedores).

## 12. Infraestructura y despliegue

- [ ] Servidor/backend detrás de un **reverse proxy** (Nginx, Cloudflare) con WAF si es posible.
- [ ] Firewall: solo puertos necesarios abiertos (443, y el de la DB/Redis solo accesibles internamente).
- [ ] Separar entornos (dev/staging/prod) con credenciales y datos distintos — nunca testear con datos reales de contactos.
- [ ] CI/CD con revisión de secretos y análisis estático antes de deploy.
- [ ] Plan de **backup + disaster recovery** documentado (no solo de la DB, también de las plantillas de campañas y configuración de las 5 cuentas).

## 13. Dependencias y supply chain

- [ ] `npm audit` / `npm audit fix` corriendo en CI, y bloquear el build ante vulnerabilidades críticas.
- [ ] Usar **Dependabot** o Renovate para mantener dependencias actualizadas automáticamente.
- [ ] Revisar dependencias con pocos mantenedores o poco uso antes de agregarlas (supply chain attacks).
- [ ] Lockfile (`package-lock.json`) commiteado y respetado en instalaciones (`npm ci`, no `npm install`, en CI/prod).

## 14. Testing de seguridad

- [ ] Checklist manual o automatizado contra **OWASP Top 10** (Injection, Broken Auth, XSS, IDOR, Security Misconfiguration, SSRF, etc.).
- [ ] Pruebas específicas de **IDOR** entre distintos usuarios/roles (intentar acceder a campañas/contactos ajenos cambiando IDs).
- [ ] Test de que el rol "encargada" **no puede escalar privilegios** manipulando el JWT o el body de un request.
- [ ] Herramientas: `OWASP ZAP` o `Burp Suite Community` para un escaneo básico antes de producción.
- [ ] Pentest externo (aunque sea acotado) antes de manejar datos reales de clientes, si el presupuesto lo permite.

## 15. Checklist rápido de "no negociables" antes de producción

- [ ] JWT en cookie httpOnly + refresh rotation
- [ ] RLS activo en Supabase
- [ ] Rate limiting en login, envío y exportación
- [ ] Sanitización de HTML de campañas (anti-XSS)
- [ ] SPF/DKIM/DMARC en las 5 cuentas + manejo de bounces/unsubscribe
- [ ] Secrets fuera del repo, `.env` en `.gitignore`
- [ ] HTTPS + Helmet + CORS restringido
- [ ] Validación de ownership (anti-IDOR) en cada endpoint
- [ ] Logs de auditoría sin datos sensibles en texto plano
- [ ] `npm audit` limpio en CI

---

*Recomendación: priorizar en este orden si el tiempo es limitado: (1) JWT/auth + IDOR, (2) RLS en Supabase, (3) sanitización XSS del HTML de campañas, (4) SPF/DKIM/DMARC + unsubscribe (para no quedar blacklisteados), (5) el resto.*
