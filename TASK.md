FRONTEND:

General:
- Cambiar title de la pagina y logo tambien
- Cambiar logo general por el de 3 de febero sin fondo que me paso Matias
- El ancho total de la pantalla me parece bastante grande, deberiamos achicarlo un poco, por lo menos en la notebook que tengo, tengo que recorrer bastante con los ojos. Tampoco excederse en el achique

Vista de Estadisticas Generales:
- Exportar CSV con las campañas hechas, con estadisticas y demas

Nueva vista: Directorio de Contactos
    
    - Error de padding en la lista desplegable de rubros y Estado, el icono de la fecha deberia estar mas a la izquierda. Tambien el contenedor general no tiene padding derecho
    duda: que pasa si no pongo rubro, como lo toma, en que categoria entra. Si la empresa es nueva, la agrega a la BD?
    Que no se puedan borrar todos, el checkbox que esta a la izquierda de donde dice "Empresa / Razon Social" no deberia existir es muy peligroso
    El confirma cuando selecciono varios para borrar tiene que ser un modal, igual al que sale cuando solo quiero eliminar uno
    El boton de eliminar varios no debe salir arriba, esta mal, no deberia salir arriba modificando el ancho del titulo, no es la pero practica jamas realizada!

En la vista de cuentas/ (SMTP)
    - Hecho: Da un error al usuario generico: Error de validación en los datos enviados
    Deberia ser email invalido, o si es valido contraseña de aplicacion invalida, al querer conectar las cuentas
    - Hecho: Deberia comprobar la cuenta, si se pudo conectar o no al servidor SMTP, sino no deberia dejar. Es decir al envair el formulario si el formato de los datos es valido:
     - Si la contraseña es invalida --> Mostrar pop Up de que la contraseña es invalida
     - Si el host es invalido --> Mostrar pop Up de que el host es invalido
     - Si la contraseña es valida --> recein ahi aparece como cuenta usable
    Hecha: Nose si hay manera de comprobar que una contraseña funciona sin mandar mail, sino, podemos hacer mandadno un mail de prueba desde esa mail, o sea hacer una conexion de prueba. SI es aasi avisamos que se enviara un mail de prueba


En la vista de nueva/ (form de nueva campaña)
 - Hecha: En todos los inputs, sale el error abajo si no se pone nada, pero eso no pasa en el de Link de Inscripcion. Si te sale el error general de Error: Error de "validación en los datos enviados". El cual no es intuitivo para el usuario. Aca deberia decir si no se completo el Link, o si es un link invalido y demas.
 - Hecha: El boton de crear otra al crear una campaña no te lleva a nueva/, sino a la vista general de las campañas. Lo mejor seria que te lleve a nueva/ para poder crear otra. Y la idea del "crear otra" es que te limpie el formulario y puedas crear otra campaña
 - Hecha: Al tocar Vista Previa, empieza muy abajo la misma, hay que hacer un scroll hacia arriba para ver el boton de Volver al Form y el detalle que dice Modo vista Previa .
 - Hecha: Al tocar en Guardar Borrador dijimos que solo es necesario poner el Asunto, lo demas no, sin embargo es todo obligatorio
 - Hecha: Puedo spamear los botones de Guardar Borrador o Aprobar la campaña al crearla. Deberia ser imposible hacerlo, bloqueando el boton al tocarlo. Deberiamos comunicar al usuario con un pop up diciendo:
  Ya fue creada como borrador / aprobada
  Si fue como borrador que haya un boton pueda ver la vista previa
  Si fue aprobada que haya un boton para que vea el detalle de la campaña
  Y que en ambas opciones este la opcion de crear otra
  Y un boton para ir a la vista general de campañas


Vista de campanas/<campana-id> :
- Hecho: En algun lado debe decir fecha limite de envio y rubros (osea los que se completaron a la hora de hacer el FORM)
- Hecho: Falta implementar la seccion estadisticas
- Hecho: Opcion de Exportar CSV pero solo con las estadisticas de ese evento,  y demas datos de ese evento
- En cola de envios no se entiende bien lo que seria Respuesta. Mas adelante hay que verlo

Nueva Seccion: soporte/
- No lo tengo definido, pero que la encargadas puedan darme tips, mejoraas o reportar errores del sistema. Un formulario que tenga algunos tipos predefinidos. Asi mas adelante cuando implementemos el tema de los roles, yo como Desarrollador puedo ver las tareas pendientes o lo que ellas escribieron para implementar por prioridad.
Que tenga como minimo: Tipo (mejora, sugerencia, error), Descripcion (textArea),Adjuntar no obligatorio (imagen, pdf, etc.).
TIene que guardarse en el sistema, pero ademas mandarme un mail y / o telegram, el cual debe configurarse tambien desde el rol de desaroollador. Al mandar el form, un modal de confirmacion de que envio el reporte (ok!) al desarrollador.

Nuevo BACKEND: Sistema de Logueo basado en roles: