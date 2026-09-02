### 📋 Roadmap de Producción: 3F Mailer

#### Fase 1: El Motor (Core Business & Entregabilidad)

* [x] **Lógica de envío y rotación SMTP (Round-Robin):** Testear exhaustivamente la asignación de cuentas, respeto de límites diarios y actualización de estados (`enviado` / `fallido`).
* [] **Link de desuscripción y manejo de rebotes:** *(Omitido según respuesta del usuario)*.
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
* [] **Refactor Visual Global:** Cambiar logo sin fondo, ajustar el `max-width` (ej: `max-w-6xl`) para mejor lectura en notebooks y refinar el CSS.
* [x] **Responsive Design:** Asegurar que las tablas y modales sean usables en resoluciones móviles/tablets.
* [x] **Actualización de Meta/Title:** Cambiar title y favicon de la página en `index.html`.

#### Fase 4: Cache (redis)

* [x] **Implementar redis:** para cachear las consultas a la base de datos. Las mas importantes
* [x] **Probar redis:**: Probar tiempos de respuesta , mostrando la diferencia entre sin / con redis

#### Fase 5: DevOps y Despliegue (Go-Live)

* [x] **Testing:** Escribir y ejecutar pruebas para los flujos críticos (Login, Poblar Cola, Rotación SMTP).
* [x] **Optimización de Recursos:** Revisar el tamaño de la imagen Docker final y limpiar logs innecesarios.
* [] **Despliegue Final:** Subir al repositorio Git corporativo (con VPN) y levantar el `docker-compose.yml` en el servidor de producción. Ya tengo el dominio disponible, tengo que configurar todo eso.
* [] **Importar los contactos de la base de datos de Google Sheets:** al sistema

#### Fase 6: Analíticas y Tracking (Prioridad Media/Alta)
[x] **Open Tracking (Pixel Invisible):** Inyectar un `<img src="https://tudominio.com/api/track/open/:id_envio" width="1" height="1" />` oculto en el HTML de la campaña. Cuando el cliente abre el mail, el servidor registra la apertura.
[x] **Click Tracking:** Envolver todos los links (ej: a tu WhatsApp o Web) con una URL redireccionadora del backend (ej: `.../api/track/click/:id_envio?url=...`).
[x] **Dashboard de Conversión:** Visualizar en el frontend el % de enviados, rebotados, abiertos y clickeados de cada campaña para medir qué copys/textos funcionan mejor.

#### Fase 7: Operatividad y Frontend (Prioridad Media)
[x] * **Importador Visual de Contactos:** Una sección en el frontend donde subas un CSV/Excel o conectes Google Sheets y puedas mapear columnas visualmente (Ej: "Columna A -> Nombre", "Columna B -> Email").
[x] * **Pausado de Emergencia:** Un botón de "Pausar Campaña" por si te das cuenta 2 minutos después de lanzar que te equivocaste en un link o en el copy, para que el cron job deje de enviar.

#### Fase 8: Infraestructura
* [x] **Detección de "Cuenta Quemada":** Si una cuenta SMTP empieza a rebotar muchos mensajes repentinamente (ej. Google la bloquea temporalmente), el sistema debería detectar ese "pico" y suspender la cuenta temporalmente, rotando todo el tráfico a las demás.
* [x] **Logs Estructurados / Alertas:** Actualmente los errores van a la consola (`console.log`). Se podría conectar algo muy simple para guardar un archivo `.log` por día, útil si el servidor queda corriendo semanas.

[x] Confirmar que anda el estado EN proceso y el boton de pausar y reanudar la campaña
[x] Que se pueda eliminar varias con un 

[x] El estado pausada en el frontend estaria bueno que aparezaca "Pausada" con la P en mayuscula
[x] El pausada  aparece cuando esta Aprobada
[x] El estado pausada no pausa nada. Esta mal ese estado
[x] Luego de que este pausado y se reanude, me marco como en rpcoeso cuando ya deberia estar completada. Es un error que puede deberse al fallo de pausada que sigue enviando, osea, no deberia pasar nunca que tengo lo pauso y no tengo mas para enviar osea completado. Osea quizas es error se solucione, arreglando el estado pausada. Ahi se arreglo a Completada nose porque
Error con los Flyers no cargan y no deberia pasar ya que antes funcionaban. En el mail aparece como que no hay imagen y en upload no aparece archivo alguno
EN la cola de envios, al tocar el boton "Actualizar", cambie a estado fallido y no se vio nada todo OK. Pero al restablecer el filtro a "Todos los estados" no me aparecia nada 

[x] Reinicie la pagina y me mando al logueo y me da "Demasiado intetnos de login, intenta devuelta en 15 minutos