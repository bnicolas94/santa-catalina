# Santa Catalina Atención

Aplicación independiente para la operación del CRM de WhatsApp. Se ejecuta en
el puerto `3001` durante el desarrollo y está pensada para desplegarse en
`atencion.santacatalina.online`.

## Desarrollo

Desde la raíz del repositorio:

```bash
npm install
npm run crm:db:deploy
npm run crm:db:seed
npm run crm:dev
npm run crm:test
npm run crm:build
npm run crm:db:validate
```

Copiar `apps/crm/.env.example` a `apps/crm/.env` y usar una base PostgreSQL
local o descartable. No ejecutar `crm:db:deploy` contra una base compartida sin
revisar primero `DATABASE_URL`.

Con `CRM_MOCK_WHATSAPP=true` los envíos obtienen un identificador simulado y no
contactan a Meta, incluso en un despliegue temporal de prueba. En desarrollo, el agente predeterminado es Marina; las APIs
aceptan `x-crm-demo-agent: marina`, `lucia` o `admin` para probar permisos y
contención. La pantalla y las APIs operan sobre PostgreSQL; el seed crea cinco
contactos ficticios, identificados con la etiqueta `Demostración`, sin vínculos
con clientes del ERP.

## Producción y backups

Antes de cualquier migración se debe ejecutar `npm run db:backup` y conservar el
archivo verificado fuera de Git. El script usa una transacción PostgreSQL
`REPEATABLE READ`, de solo lectura, para que todas las tablas representen el
mismo instante. En Railway también se recomienda crear o confirmar un snapshot
nativo del volumen antes de cambios de estructura.

Si el CRM comparte la base productiva del ERP, su `DATABASE_URL` debe usar
`?schema=crm`; nunca debe reutilizar sin cambios la URL del esquema `public`.

## API implementada

```text
GET  /api/conversations
GET  /api/conversations/{id}
POST /api/conversations/{id}/claim
POST /api/conversations/{id}/heartbeat
POST /api/conversations/{id}/release
POST /api/conversations/{id}/messages

GET  /api/admin/channels
POST /api/admin/channels
PUT  /api/admin/channels/{id}
POST /api/admin/channels/{id}/validate
GET  /api/admin/configuration

GET  /api/webhooks/whatsapp
POST /api/webhooks/whatsapp
```

`claim` entrega un `lockToken`. `heartbeat`, `release` y `messages` requieren ese
token; el lease dura 75 segundos. Cada envío debe incluir un
`clientMessageId` único para que un reintento no duplique el mensaje.

La pantalla `/settings` es exclusiva para administradores. Muestra el estado de
la clave maestra y de cada secreto sin devolver su contenido, permite conservar
credenciales dejando los campos vacíos e impide activar un canal incompleto.
La activación también exige una validación previa y vigente contra Meta.

Orden de configuración:

1. Definir `WHATSAPP_CONFIG_ENCRYPTION_KEY` en el entorno del CRM.
2. Guardar identidad, Access Token, App Secret y Verify Token.
3. Ejecutar **Validar conexión con Meta**. La API consulta, en modo lectura,
   `/{WABA-ID}/phone_numbers` y confirma el Phone Number ID.
4. Activar el canal solamente después de una respuesta válida.

Modificar el WABA, Phone Number ID, versión Graph API o cualquier secreto vuelve
el canal a `PENDING`, lo desactiva y exige una nueva validación.

## Límites del módulo

- El esquema Prisma de esta app sólo administra tablas del esquema PostgreSQL
  `crm`.
- Los identificadores de empleados y clientes del ERP son referencias externas,
  no claves foráneas compartidas.
- En producción se valida la cookie de sesión firmada por el ERP y los permisos
  `permisoAtencion` / `permisoAtencionAdmin`.
- La ruta `/api/webhooks/*` queda deliberadamente fuera de la sesión de usuario;
  el webhook valida el challenge, la firma de Meta y deduplica el cuerpo recibido.
- Los tokens de Meta y el App Secret se cifran con AES-256-GCM. Las APIs de
  administración nunca devuelven los secretos al navegador.

La arquitectura y los contratos previstos se documentan en
`docs/crm-whatsapp-arquitectura.md`.
