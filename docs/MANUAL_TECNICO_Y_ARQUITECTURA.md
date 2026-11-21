# 📘 GenMailer — Manual Técnico, Arquitectura y Guía de Ingeniería

> **Propósito:** Documento técnico de referencia sobre el diseño, arquitectura, modelos de datos y patrones de ingeniería implementados en **GenMailer**. Diseñado como guía de arquitectura para evaluación de portfolio y consulta de desarrolladores.  
> **Versión del Sistema:** 2.0 (Producción / Portfolio Edition)  
> **Licencia:** MIT  

---

## 📑 Tabla de Contenidos

1. [Visión General y Propósito del Sistema](#1-visión-general-y-propósito-del-sistema)
2. [Arquitectura de Alto Nivel y Stack Tecnológico](#2-arquitectura-de-alto-nivel-y-stack-tecnológico)
3. [Modelo de Datos Relacional (PostgreSQL)](#3-modelo-de-datos-relacional-postgresql)
4. [El Motor de Envíos (Mailing Engine) y Dosificador Inteligente](#4-el-motor-de-envíos-mailing-engine-y-dosificador-inteligente)
5. [Rotación SMTP Multi-Cuenta, Cuotas y Cuenta Principal](#5-rotación-smtp-multi-cuenta-cuotas-y-cuenta-principal)
6. [Circuit Breaker, Umbrales y Reset de Medianoche](#6-circuit-breaker-umbrales-y-reset-de-medianoche)
7. [Segmentación y Aislamiento de Audiencias](#7-segmentación-y-aislamiento-de-audiencias)
8. [Detección y Tratamiento de Rebotes (IMAP & Resend)](#8-detección-y-tratamiento-de-rebotes-imap--resend)
9. [Seguridad, Criptografía y Hardening](#9-seguridad-criptografía-y-hardening)
10. [Guía de Ejecución Local con Docker Compose](#10-guía-de-ejecución-local-con-docker-compose)

---

## 1. Visión General y Propósito del Sistema

**GenMailer** es una plataforma integral de email marketing masivo y comunicaciones transaccionales diseñada para sortear las limitaciones más habituales en el envío masivo de correos corporativos:

- **Superación de techos de cuota diaria:** Los proveedores gratuitos o estándar (Gmail, Google Workspace) imponen techos estrictos (500 correos diarios por casilla). GenMailer implementa un pool de múltiples cuentas autenticadas tanto por SMTP como por **Gmail API (OAuth 2.0)**, balanceando la carga en Round-Robin para enviar miles de correos diarios sin incurrir en bloqueos.
- **Protección de entregabilidad y reputación:** Algoritmos de dosificación horaria adaptativa, cadencia humana con jitter pseudo-aleatorio entre correos, generación de Message-IDs conformes a RFC 2822 y mitigación activa de rebotes duros.
- **Operación ágil y autónoma:** Diseñada para que equipos de operaciones redacten campañas visuales con editor TipTap enriquecido, previsualicen en tiempo real, gestionen audiencias masivas o ad-hoc, y supervisen telemetría en vivo vía Server-Sent Events (SSE).

---

## 2. Arquitectura de Alto Nivel y Stack Tecnológico

El sistema adopta una arquitectura multicapa desacoplada y 100% contenerizada en Docker:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Cliente Web (React 19 + Vite)                   │
│             Tailwind CSS v4 • TipTap • Zustand • Recharts              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Reverse Proxy Nginx (Puerto 80/443)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Backend API (Node.js 22 + TypeScript)               │
│              Express • Zod • Workers Cron Asíncronos • SSE             │
└──────────┬────────────────────────┬────────────────────────┬───────────┘
           │                        │                        │
           ▼                        ▼                        ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
           ▼                        ▼                        ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│  PostgreSQL (v15)    │ │    Redis Cache (v7)  │ │   Servicios Externos │
│ Migraciones auto SQL │ │  Rate Limit & Locks  │ │ • Gmail API (OAuth2) │
│ Consultas Relacionales│ └──────────────────────┘ │ • Resend Webhooks    │
└──────────────────────┘                          │ • Servidores IMAP    │
                                                  └──────────────────────┘
```

### Stack Técnico:
- **Backend:** Node.js v22 LTS, TypeScript en modo estricto, Express 5, Zod para validación de esquemas HTTP y asíncronos, Nodemailer, ImapFlow, Node-Cron, Winston Logger con rotación diaria.
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, TipTap Rich Text Editor, Zustand para estado global.
- **Base de Datos & Cache:** PostgreSQL 15 para persistencia relacional con transacciones atómicas; Redis 7 para rate limiting distribuido y locks de exclusión mutua en workers.
- **Infraestructura:** Docker Compose con compilaciones multi-stage optimizadas y ejecución bajo usuario sin privilegios (`USER node`).

---

## 3. Modelo de Datos Relacional (PostgreSQL)

El esquema de base de datos modela la relación entre campañas, contactos, colas de despacho y credenciales seguras:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     campanas    │       │   cola_envios   │       │    contactos    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │1     *│ id (PK)         │*     1│ id (PK)         │
│ titulo          ├───────┤ campana_id (FK) ├───────┤ email (UK)      │
│ asunto          │       │ contacto_id(FK) │       │ nombre_empresa  │
│ contenido_html  │       │ cuenta_smtp(FK) │       │ rubro_id        │
│ estado          │       │ estado          │       │ estado          │
│ tipo_audiencia  │       │ intentos        │       │ es_contacto_base│
│ fecha_limite    │       │ enviado_en      │       └─────────────────┘
│ cuenta_fijada_id│       │ respuesta_smtp  │
└────────┬────────┘       └────────┬────────┘
         │ 1                       │ *
         │ *                       │ 1
┌────────┴────────┐       ┌────────┴────────┐
│ campana_adjuntos│       │   cuentas_smtp  │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ campana_id (FK) │       │ email (UK)      │
│ nombre_archivo  │       │ limite_diario   │
│ ruta_archivo    │       │ enviados_hoy    │
│ mime_type       │       │ estado          │
│ peso_bytes      │       │ es_principal    │
└─────────────────┘       │ umbral_errores  │
                          │ bloqueada_hasta │
                          └─────────────────┘
```

### Migraciones Idempotentes Automáticas
En lugar de depender de ORMs pesados, el backend implementa un runner de migraciones nativo en `src/index.ts`. Al iniciar la API, lee secuencialmente los scripts `.sql` en `src/migrations/`, registra su aplicación en la tabla `_schema_migrations` y aplica cambios de forma transaccional e idempotente.

---

## 4. El Motor de Envíos (Mailing Engine) y Dosificador Inteligente

El despacho masivo de correos opera mediante un worker desacoplado (`src/services/emailWorker.ts`) regulado por un algoritmo de dosificación adaptativa (`src/services/dosificadorService.ts`):

1. **Poblado Atómico:** Al aprobar o iniciar una campaña, `poblarColaEnvios()` genera los registros en `cola_envios` con estado `'pendiente'`. La restricción `UNIQUE (campana_id, contacto_id)` previene estrictamente duplicados.
2. **Cálculo de Lote Óptimo:** El dosificador calcula dinámicamente la cantidad de correos a despachar en cada ventana de ejecución:
   $$\text{Lote} = \min\left(\text{Capacidad Global Restante},\; \frac{\text{Pendientes}}{\text{Ventanas restantes hasta la fecha límite}}\right)$$
   Ajustándose dentro de un piso mínimo (evita subutilización) y un techo prudencial (previene bloqueos por ráfagas).
3. **Cadencia Antispam con Jitter:** Entre cada mensaje despachado, el worker introduce un retardo pseudo-aleatorio configurable (entre 4.000 ms y 9.000 ms) simulando el comportamiento de un remitente humano real.

---

## 5. Rotación SMTP Multi-Cuenta, Cuotas y Cuenta Principal

El gestor de colas distribuye el despacho mediante rotación Round-Robin (`src/services/queueService.ts`):

- **Selección de Cuenta:** Filtra cuentas con `estado = 'activo'` y `enviados_hoy < limite_diario`, ordenadas por `ultimo_uso ASC NULLS FIRST`.
- **Cuenta Principal (`es_principal = true`):** Los administradores pueden designar una cuenta como la cuenta principal del sistema desde el panel web. Esta cuenta se utiliza como remitente predeterminado para comunicaciones transaccionales, alertas del sistema y envíos directos donde no se especifique una rotación aleatoria.
- **Soporte Híbrido:** Admite autenticación clásica SMTP con contraseñas de aplicación cifradas y autenticación moderna OAuth 2.0 mediante la API oficial de Google.

---

## 6. Circuit Breaker, Umbrales y Reset de Medianoche

Para salvaguardar la reputación de las credenciales, el sistema implementa protección activa ante incidentes:

- **Umbral de Errores Configurable (`umbral_errores`):** Cada cuenta permite configurar una cantidad máxima de fallos/rebotes tolerados en una ventana móvil de 24 horas (valor sugerido: 30).
- **Bloqueo Preventivo Temporal:** Al alcanzar el umbral, el Circuit Breaker conmuta la cuenta a estado `bloqueado` y fija `bloqueada_hasta = (CURRENT_DATE + INTERVAL '1 day')`, retirándola del pool por el resto de la jornada.
- **Ciclo de Reactivación a Medianoche (00:00 hs):** El cron diario ejecuta `resetearContadoresSmtp()`:
  - Reinicia `enviados_hoy = 0`.
  - Reactiva a `activo` las cuentas en estado `agotado` o `bloqueado` temporalmente.
  - **Aislamiento de Cuentas Inactivas:** Las cuentas puestas en estado `inactivo` manualmente por un usuario nunca son modificadas por el reset automático.
- **Simulación para Desarrolladores:** Desde el panel de administración, los usuarios con rol `desarrollador` pueden pulsar **"Simular Medianoche (Reset)"** para probar el ciclo de desbloqueo de forma instantánea sin esperar a las 00:00 hs.

---

## 7. Segmentación y Aislamiento de Audiencias

GenMailer distingue y aísla dos tipos de destinatarios:

1. **Audiencias Masivas por Rubro (`es_contacto_base = true`):** Destinatarios pertenecientes al padrón general de la organización, segmentables por categorías o sectores de actividad.
2. **Audiencias Manuales Ad-hoc (`es_contacto_base = false`):** Contactos importados o pegados manualmente para campañas puntuales. Estos contactos se aíslan para no contaminar la base principal y evitar que campañas masivas posteriores les envíen correos inadvertidamente.

---

## 8. Detección y Tratamiento de Rebotes (IMAP & Resend)

La higiene de listas se gestiona mediante dos canales automáticos:

1. **Monitor IMAP (`bounceService.ts`):** Inspecciona periódicamente las bandejas de entrada en busca de mensajes de entrega fallida (*Mail Delivery Subsystem* o *Mailer-Daemon*), procesando encabezados RFC-3464 (`Action: failed`, `Status: 5.X.X`) para marcar contactos como `rebotado`.
2. **Webhooks Oficiales de Resend (`webhookRoutes.ts`):** Para envíos cursados vía Resend, se procesan eventos en tiempo real (`email.bounced`, `email.complained`, `email.opened`, `email.clicked`). Cada solicitud entrante se valida criptográficamente mediante firmas **Svix** (`svix-id`, `svix-timestamp`, `svix-signature`).

---

## 9. Seguridad, Criptografía y Hardening

- **Cifrado de Credenciales:** Las contraseñas SMTP y tokens sensibles se almacenan cifrados en base de datos mediante **AES-256-GCM** con vectores de inicialización (IV) aleatorios de 16 bytes y etiquetas de autenticación.
- **Autenticación con Cookies HttpOnly:** Los tokens JWT de sesión se transmiten exclusivamente mediante cookies `HttpOnly`, `SameSite=Lax` (y `Secure` en HTTPS), mitigando ataques de robo de sesión vía XSS.
- **Control de Acceso Basado en Roles (RBAC):** Tres roles con permisos diferenciados: `desarrollador` (acceso a auditoría, resets y configuración avanzada), `encargado` (creación y gestión de campañas y contactos) e `invitado` (solo lectura).
- **Sanitización y Anti-XSS:** El frontend sanitiza todo el contenido HTML con DOMPurify y valida entradas con esquemas Zod tanto en cliente como en servidor.

---

## 10. Guía de Ejecución Local con Docker Compose

La arquitectura está completamente contenerizada para iniciar con un único comando:

```bash
# 1. Clonar el repositorio
git clone https://github.com/LeonardoMuranodev/mailing-platform-demo.git
cd mailing-platform-demo

# 2. Configurar variables de entorno
cp .env.example .env

# 3. Levantar servicios completos (Backend, Frontend, PostgreSQL, Redis)
docker compose up --build
```

### URLs de Acceso Local:
- **Frontend SPA:** [http://localhost:80](http://localhost:80)
- **Backend API:** [http://localhost:3000](http://localhost:3000)
- **Healthcheck:** [http://localhost:3000/api/health](http://localhost:3000/api/health)
- **Credenciales por defecto (Seed):** `admin@genmailer.com` / `Admin1234!`
