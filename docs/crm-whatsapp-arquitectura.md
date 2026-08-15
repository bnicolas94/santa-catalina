# CRM de WhatsApp — arquitectura inicial

## Decisión

El CRM es una aplicación desplegable de forma independiente en
`atencion.santacatalina.online`. El ERP actual permanece en la raíz del
repositorio durante la migración incremental; moverlo inmediatamente a
`apps/erp` agregaría riesgo sin aportar una separación funcional adicional.

```text
app.santacatalina.online        ERP actual (raíz)
empleados.santacatalina.online  vista especializada del ERP
atencion.santacatalina.online   apps/crm (despliegue independiente)
```

El monorepo contiene contratos de integración en `packages/contracts`. Los dos
despliegues pueden versionar el mismo contrato sin compartir implementaciones ni
acceso irrestricto a tablas.

## Responsabilidades

### CRM

- Bandejas, conversaciones, asignaciones, bloqueos y auditoría.
- Recepción y validación de webhooks de Meta.
- Envío de mensajes y seguimiento de estados.
- Persistencia de contactos de canal y su vínculo opcional con un cliente ERP.
- Configuración cifrada de canales de WhatsApp.
- Notificaciones en tiempo real y trabajos de descarga de medios.

### ERP

- Fuente de verdad de empleados, roles, clientes, pedidos, productos y precios.
- Inicio de sesión y emisión de la cookie compartida.
- API interna de lectura de contexto comercial y creación controlada de
  borradores de pedido.

## Autenticación y permisos

La cookie de producción `__Secure-next-auth.session-token` ya usa el dominio
`.santacatalina.online`. El CRM valida el JWT con el mismo `NEXTAUTH_SECRET`, pero
no implementa un segundo formulario de acceso.

La sesión debe incluir:

```ts
{
  id: string
  rol: string
  permisos: {
    permisoAtencion?: boolean
    permisoAtencionAdmin?: boolean
  }
}
```

`ADMIN` conserva acceso total. Un agente normal requiere `permisoAtencion`; las
reasignaciones forzadas, configuración y métricas requieren
`permisoAtencionAdmin`.

Compartir temporalmente el secreto de sesión es compatible con la arquitectura
actual. Si se agregan más aplicaciones, debe reemplazarse por un proveedor de
identidad central para reducir el alcance del secreto.

## Datos

`apps/crm/prisma/schema.prisma` administra exclusivamente el esquema PostgreSQL
`crm`. Sus identificadores `erpClientId`, `assignedToId`, `sentById` y
`performedById` son referencias lógicas al ERP. Esta decisión permite separar la
base físicamente en el futuro sin reescribir el dominio del CRM.

Entidades principales:

- `WhatsAppChannel`: identificadores del canal y secretos cifrados.
- `Contact`: teléfono E.164, `waId` y vínculo opcional con Cliente.
- `Conversation`: estado, agente asignado y lease de edición.
- `Message`: mensajes entrantes, salientes e internos con idempotencia.
- `ConversationAssignment` y `ConversationEvent`: auditoría.
- `WebhookReceipt`: deduplicación sin conservar indiscriminadamente payloads.
- `QuickReply`, `Tag` y `ConversationTag`: herramientas operativas.

## Propiedad y bloqueo

La asignación y el bloqueo activo son conceptos distintos:

- `assignedToId` permanece hasta resolver, liberar o transferir.
- `activeById`, `lockToken`, `lockExpiresAt` y `lockVersion` forman un lease corto
  para la ventana abierta.

La toma debe ejecutarse con una operación atómica equivalente a:

```sql
UPDATE crm.conversations
SET assigned_to_id = :agent_id,
    active_by_id = :agent_id,
    lock_token = :new_token,
    lock_expires_at = NOW() + INTERVAL '75 seconds',
    lock_version = lock_version + 1
WHERE id = :conversation_id
  AND (
    assigned_to_id IS NULL
    OR assigned_to_id = :agent_id
  )
  AND (
    active_by_id IS NULL
    OR active_by_id = :agent_id
    OR lock_expires_at < NOW()
  )
RETURNING *;
```

Si no retorna una fila, la API responde `409 CONVERSATION_LOCKED`. El endpoint de
envío vuelve a comprobar asignación, token y vencimiento dentro de una
transacción. El navegador renueva el lease cada 25 segundos y el lease vence a
los 75 segundos. El realtime mejora la interfaz, pero nunca decide quién puede
enviar.

## Contratos ERP previstos

Las rutas siguientes aún no se exponen públicamente; definen la frontera que se
implementará antes de conectar datos reales:

```text
GET  /api/internal/crm/customers/resolve?phoneE164=...
GET  /api/internal/crm/customers/{clienteId}/summary
GET  /api/internal/crm/customers/{clienteId}/orders?limit=5
POST /api/internal/crm/orders/drafts
GET  /api/internal/crm/catalog/search?q=...
```

Estas rutas usan autenticación servicio-a-servicio, scopes acotados, timeout,
auditoría y un identificador de correlación. El CRM no recibe permisos para
consultar directamente el resto del esquema público.

## Configuración y secretos

En entorno se define solamente la infraestructura necesaria para arrancar:

```text
DATABASE_URL
NEXTAUTH_SECRET
ERP_BASE_URL
CRM_BASE_URL
WHATSAPP_CONFIG_ENCRYPTION_KEY
```

La pantalla administrativa guardará cifrados el access token y el App Secret.
WABA ID, Phone Number ID y versión de Graph API pueden persistirse como
configuración no secreta. Los valores cifrados nunca vuelven al navegador y la
interfaz sólo muestra una versión enmascarada.

## Despliegue

El despliegue del CRM debe ejecutar:

```bash
npm ci
npm run crm:db:generate
npm run crm:build
```

Las migraciones de `prisma/migrations` pertenecen al ERP y las de
`apps/crm/prisma/migrations` pertenecen al CRM. Deben tener pipelines separados.

## Estado de esta entrega

Implementado:

- Workspace y aplicación Next.js independiente.
- Prototipo responsive de bandeja y conversación.
- Interfaz operativa conectada a las APIs y a PostgreSQL, con polling de bandeja,
  heartbeat cada 25 segundos y envío idempotente.
- Representación amigable de asignación y sólo lectura.
- Esquema CRM inicial y migración SQL.
- Contratos TypeScript compartidos.
- Permisos de Atención en los roles del ERP.
- Validación de sesión compartida para producción.
- APIs Prisma de bandeja, detalle, claim, heartbeat, release y envío.
- Lease atómico de 75 segundos con validación dentro de la transacción de envío.
- Idempotencia de salida mediante `clientMessageId`.
- Adaptador de WhatsApp Cloud API con modo local simulado.
- Webhook con challenge, verificación HMAC, deduplicación y actualización
  monotónica de estados de entrega.
- APIs administrativas de canales con secretos cifrados mediante AES-256-GCM.
- Pantalla administrativa responsive con secretos enmascarados, diagnóstico de
  entorno, URL de webhook y bloqueo de activación incompleta.
- Validación de solo lectura contra Meta que confirma token, WABA y Phone Number
  ID antes de permitir activar un canal.
- Pruebas unitarias de leases, cifrado, firmas y parsing de eventos.
- Seed repetible de cinco conversaciones ficticias, aisladas de los clientes ERP.
- Backup previo consistente y de solo lectura como condición de despliegue.

Siguiente incremento:

1. Incorporar realtime distribuido y trabajos en segundo plano.
2. Implementar las APIs internas del ERP para contexto de clientes y pedidos.
3. Agregar pruebas de integración contra PostgreSQL para carreras simultáneas.
4. Incorporar suscripción controlada del webhook al WABA una vez configuradas
   las credenciales reales.
