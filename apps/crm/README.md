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
GET  /api/conversations/{id}/customer-context
POST /api/conversations/{id}/customer-context
POST /api/conversations/{id}/claim
POST /api/conversations/{id}/heartbeat
POST /api/conversations/{id}/release
POST /api/conversations/{id}/messages
PUT  /api/conversations/{id}/tags
PUT  /api/conversations/{id}/order-draft
POST /api/conversations/{id}/resolve
POST /api/conversations/{id}/archive
POST /api/conversations/{id}/unassign  # sólo supervisión

GET  /api/tags
GET  /api/quick-replies

GET  /api/admin/channels
POST /api/admin/channels
PUT  /api/admin/channels/{id}
POST /api/admin/channels/{id}/validate
GET  /api/admin/configuration
GET  /api/admin/embedded-signup
POST /api/admin/embedded-signup
POST /api/admin/channels/{id}/continuity

GET  /api/webhooks/whatsapp
POST /api/webhooks/whatsapp
```

`claim` entrega un `lockToken`. `heartbeat`, `release` y `messages` requieren ese
token; el lease dura 75 segundos. Cada envío debe incluir un
`clientMessageId` único para que un reintento no duplique el mensaje.

Un operador sólo puede listar y abrir conversaciones sin asignar o asignadas a
su propio usuario. `ADMIN` y quienes tengan `permisoAtencionAdmin` pueden ver la
bandeja completa y liberar una asignación; la liberación invalida el lease y
queda registrada en asignaciones y eventos.

La UI ejecuta `claim` automáticamente al abrir una conversación sin asignar. Si
dos agentes la abren al mismo tiempo, la operación atómica asigna a uno solo y
el otro actualiza su bandeja sin obtener permiso de respuesta.

Cada conversación tiene una ficha rápida de pedido con productos y presentaciones
activas del catálogo ERP, cantidades, observaciones, fecha calendario, dirección,
modalidad `DELIVERY`/`PICKUP`, local de retiro y turno
`MORNING`/`SIESTA`/`AFTERNOON`. La UI la guarda automáticamente, ofrece accesos
rápidos para fechas y sólo permite editarla al agente que conserva el lease. Un
retiro exige seleccionar una ubicación activa de tipo `LOCAL` obtenida mediante
la API interna del ERP; se guarda su ID externo y el nombre como instantánea. Un
envío exige dirección para considerar completa la ficha. Cada actualización deja
un evento de auditoría.

Los productos configurables usan variedades estructuradas del ERP. El operador
elige únicamente botones habilitados —por ejemplo `TOM` o `LECHU`— y nunca escribe
el sabor. La ficha distingue líneas con la misma presentación y distinta variedad,
valida la relación en el servidor y conserva ID, código y nombre como instantánea.
En Elegidos cada pulsación representa exclusivamente una porción `x8`; la cantidad
acumula esas porciones (`+2` equivale a `x16`) y ninguna presentación mayor puede
asignarse directamente a un sabor.

El botón `Agendado` no crea todavía un `Pedido` en el ERP. En una única
transacción fotografía la ficha completa en `ScheduledOrder`, incluido si el pago
por transferencia fue confirmado, registra agente y
horario, deja el evento `ORDER_SCHEDULED_EXTERNALLY` y limpia la ficha activa.
El historial permanece asociado a la conversación para que un cliente recurrente
pueda iniciar otro pedido sin sobrescribir los anteriores. La acción usa un
`clientActionId` único para evitar duplicados ante reintentos. El detalle muestra
todos los datos agendados en un modal al seleccionar cualquier tarjeta del
historial, incluida la lista de productos, destino, turno, pago, observaciones,
la marca temporal y el nombre actual del empleado,
resuelto de forma segura mediante la API interna del ERP. Los IDs del producto,
la presentación y la variedad se acompañan con una instantánea de nombre, código
y unidades por paquete para que cambios posteriores del catálogo no alteren el
historial.

`customer-context` consulta el ERP con la misma sesión segura del agente. Si el
teléfono coincide con un único cliente activo, conserva el vínculo en
`Contact.erpClientId`; si existen duplicados, devuelve candidatos para que el
operador elija. El panel autocompleta la dirección actual del ERP cuando la ficha
todavía no tiene una y muestra dirección, zona, segmento y los cinco pedidos más
recientes. Cada resumen abre un detalle completo con productos, cantidades,
precios, entrega y pago, sin habilitar acceso directo del CRM al esquema `public`.

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

### Coexistence con WhatsApp Business

El número que ya opera en WhatsApp Business sólo debe conectarse mediante el
botón **Conectar con Coexistence**. El flujo usa Embedded Signup con
`featureType=whatsapp_business_app_onboarding`; nunca se debe registrar o migrar
manualmente ese número. Requiere estas variables adicionales en el servicio CRM:

```text
META_APP_ID
META_APP_SECRET
META_EMBEDDED_SIGNUP_CONFIG_ID
META_GRAPH_API_VERSION
META_WEBHOOK_VERIFY_TOKEN
```

El backend intercambia el código de autorización, descubre el número, exige que
Meta responda `is_on_biz_app=true` y `platform_type=CLOUD_API`, suscribe el
webhook y guarda las credenciales cifradas. El canal siempre queda inactivo al
terminar. Para habilitarlo, un administrador debe confirmar en la UI que la app
móvil, todos los dispositivos vinculados y los mensajes bidireccionales siguen
funcionando.

El webhook procesa mensajes normales y los eventos de Coexistence `history`,
`smb_app_state_sync`, `smb_message_echoes` y `account_update`. Una baja o
reconexión reportada por Meta desactiva el canal y obliga a repetir la
verificación de continuidad.

### Coexistence mediante YCloud

El administrador puede crear un canal con proveedor **YCloud** sin repetir el
onboarding del número. Para este proveedor se cargan en `/settings` el número
E.164, el WABA ID, la API Key y el Webhook Signing Secret; los dos secretos se
cifran con `WHATSAPP_CONFIG_ENCRYPTION_KEY` y nunca vuelven al navegador.

El callback que debe registrarse en YCloud es:

```text
https://atencion.santacatalina.online/api/webhooks/ycloud
```

Debe suscribirse a `whatsapp.inbound_message.received`,
`whatsapp.message.updated`, `whatsapp.smb.message.echoes` y
`whatsapp.smb.history`. El endpoint valida `YCloud-Signature` con HMAC-SHA256,
acepta sólo eventos con una antigüedad máxima de cinco minutos y deduplica por
el ID estable del evento. Los envíos usan `sendDirectly`, `X-API-Key` y el
`clientMessageId` del CRM como `externalId`.

La validación del canal consulta el número registrado en YCloud sin enviar
mensajes. Luego exige la misma confirmación administrativa de continuidad de la
app móvil, dispositivos vinculados y mensajes bidireccionales antes de activar
el canal. `CRM_MOCK_WHATSAPP=true` continúa bloqueando todo envío real aunque el
canal esté configurado.

## Límites del módulo

- El esquema Prisma de esta app sólo administra tablas del esquema PostgreSQL
  `crm`.
- Los identificadores de empleados y clientes del ERP son referencias externas,
  no claves foráneas compartidas.
- En producción se valida la cookie de sesión firmada por el ERP y los permisos
  `permisoAtencion` / `permisoAtencionAdmin`.
- La ruta `/api/webhooks/*` queda deliberadamente fuera de la sesión de usuario;
  el webhook valida el challenge, la firma de Meta y deduplica el cuerpo recibido.
- Los tokens de Meta, la API Key de YCloud y los secretos de firma se cifran con AES-256-GCM. Las APIs de
  administración nunca devuelven los secretos al navegador.

La arquitectura y los contratos previstos se documentan en
`docs/crm-whatsapp-arquitectura.md`.
