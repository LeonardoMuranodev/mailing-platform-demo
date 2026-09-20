# 📧 Plataforma de Mailing y Gestión de Campañas

![Dashboard Principal](docs/assets/dashboard.png)

Una plataforma integral para el envío masivo de correos electrónicos, gestión de contactos y análisis estadístico, diseñada con un enfoque en la escalabilidad, la experiencia de usuario y el manejo eficiente de límites de servidores SMTP.

## 📖 Historia del Proyecto

Este proyecto nació como una solución a medida para la **Municipalidad de Tres de Febrero**. En su origen, el sistema fue desarrollado mano a mano con las encargadas del área de comunicación. A través de un proceso iterativo de escucha activa, fui adaptando la plataforma a sus necesidades reales del día a día: desde la creación intuitiva de plantillas HTML hasta la necesidad crítica de sortear los límites estrictos de envío diario de los servidores de correo (como el límite de 400 correos por día de Gmail).

Esta versión (GenMailer) es una **adaptación genérica y mejorada** de ese software en producción. Se han eliminado datos sensibles y lógicas exclusivas del municipio, transformándolo en un producto SaaS marca blanca, ideal para demostrar su arquitectura técnica y fluidez.

---

## 🚀 Características Principales

- **Gestor Inteligente de Colas SMTP:** Rotación automática de múltiples cuentas SMTP. Si una cuenta agota su límite de envíos diarios, el sistema cambia dinámicamente a la siguiente sin interrumpir la campaña.
- **Procesamiento Asíncrono (Workers):** Tareas en segundo plano (Cron Jobs) que manejan el despacho progresivo de correos y la lectura de bandejas IMAP para detectar rebotes y limpiar automáticamente las listas de contactos.
- **Dashboard Estadístico:** Gráficos interactivos de altas y bajas, tasas de entrega, y estadísticas por rubro, impulsados por consultas SQL optimizadas.
- **Seguridad y Cifrado:** Las credenciales de las cuentas SMTP se almacenan encriptadas en la base de datos utilizando el estándar **AES-256-GCM**.
- **Gestor de Contactos y Rubros:** Importación masiva, filtrado por estados (funcionales, rebotados) y categorización dinámica.

![Vista de Campañas](docs/assets/campanas.png)

---

## 🛠️ Stack Tecnológico

**Desarrollado íntegramente por [Leonardo Murano](https://www.linkedin.com/in/leonardo-murano)**, este proyecto demuestra un dominio completo (Full-Stack) sobre arquitecturas modernas:

### Backend
- **Node.js & Express:** API RESTful robusta y modular.
- **PostgreSQL:** Base de datos relacional. Se utilizan transacciones, constraints y consultas complejas (JOINs, agrupaciones) para los reportes estadísticos.
- **Nodemailer & node-imap:** Protocolos de bajo nivel para el envío de correos y lectura de bandejas de entrada.
- **node-cron:** Implementación de Workers para el procesamiento de colas.
- **Criptografía nativa (crypto):** Para el cifrado seguro de contraseñas de terceros.

### Frontend
- **React.js (Vite):** Arquitectura SPA extremadamente rápida y ligera.
- **TailwindCSS:** Sistema de diseño responsivo y moderno (Glassmorphism, Dark/Light modes sutiles).
- **Zustand:** Manejo del estado global de autenticación de manera limpia y sin boilerplate.
- **Recharts:** Renderizado de gráficos SVG para estadísticas.

### Infraestructura
- **Docker & Docker Compose:** Contenerización de los servicios (Frontend, Backend, Base de Datos) para lograr un entorno reproducible con un solo comando.

![Estadísticas Avanzadas](docs/assets/estadisticas.png)

---

## ⚙️ Cómo Levantar el Proyecto (Entorno Local)

El proyecto está 100% dockerizado para que su ejecución sea trivial sin importar tu sistema operativo.

### Prerrequisitos
- Tener **Docker** y **Docker Compose** instalados.

### Pasos

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/LeonardoMuranodev/mailing-platform-demo.git
   cd mailing-platform-demo
   ```

2. **Configurar variables de entorno:**
   Copia el archivo de ejemplo y revisa sus valores.
   ```bash
   cp .env.example .env
   ```
   *(Las contraseñas maestras y la clave de encriptación ya vienen provistas por defecto en el entorno de desarrollo).*

3. **Levantar los contenedores:**
   ```bash
   docker compose up --build
   ```

4. **Acceder a la Plataforma:**
   - **Frontend:** http://localhost:80
   - La base de datos ejecutará automáticamente las migraciones SQL y un script de **Seeding** poblado con datos de prueba realistas (campañas, contactos, reportes).
   - *Nota: Utiliza las credenciales definidas en tu `.env` para iniciar sesión.*

![Gestión de Cuentas SMTP](docs/assets/cuentas.png)

---

## 👨‍💻 Autor

**Leonardo Murano**  
Full-Stack Developer  
- [LinkedIn](https://www.linkedin.com/in/leonardo-murano)
- [GitHub](https://github.com/LeonardoMuranodev)
