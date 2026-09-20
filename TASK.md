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

Se tienen que borrar del rol de invitado los botones de Eliminar campaña, y archivar, tanto en la lista de campañas, como al entrar en una especifica: no deberia ni poder reanudarse, pausarse forzar envio eliminar nada, solo leer el estado y exportar CSV. Da error 403 osea esta bien, pero el FRONT no esta preparado para eso

Al Forzar el envio, deberia salir un POP UP o modal como siempre, mismo estilo que siempre. Si se confirma el envio, ahi se hace, para mas seguridad de que no lo toquen por error. Ademas cuando se haya forzado el envio esa opcion deberia desaparecer. No recuero como funciona, si envia todos los mails (entonces desaparecer ya que no tiene sentido), si es solo una ejecucion entonces deberia desaparecer hasta que termine. Si no hay manera de saber cuando termina un envio, entonces que desaparezca 10 min. Ahi lo vi y solo fuerza una sola ejecucion

Sigue pasando que a veces toco actualizar la campaña para ver la cola de envios, y se queda sin nada, incluso le doy al f5 y sigue pasnado, la manera para sacar eso es que ponga algo en los filtros y le de a Limpiar, debe haber un problema con el cache. FIjate que es lo que hace limpiar que lo soluciona para que lo hagan actualizar o por lo menos el f5