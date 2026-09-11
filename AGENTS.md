# Contexto operativo de Santa Catalina

> Última verificación: 2026-08-20. Este es el punto de entrada para trabajar en el repositorio sin relevar la aplicación completa en cada tarea.

## Cómo usar este archivo

1. Leer este archivo antes de investigar una tarea.
2. Abrir sólo el módulo, servicio, modelos y pruebas indicados en el mapa de abajo.
3. Confirmar en el código cualquier detalle que afecte datos, permisos, dinero, stock o liquidaciones.
4. Actualizar este archivo en el mismo cambio si se modifica la arquitectura, una regla transversal, un comando o una fuente de verdad.

Jerarquía de fuentes, de mayor a menor autoridad:

1. Código, `prisma/schema.prisma`, migraciones y pruebas actuales.
2. Este archivo como mapa operativo.
3. `docs/modules/*.md` y documentos específicos de arquitectura.
4. `PRD.md` como intención de producto.
5. `RESUMEN_TECNICO.md` y `README.md`, que contienen información histórica o genérica y no deben tomarse como descripción exacta del estado actual.

## Resumen del sistema

Santa Catalina es un sistema de gestión industrial y comercial para una sandwichería. El repositorio es un monorepo npm con dos aplicaciones y un paquete compartido:

- **ERP principal (raíz):** operaciones de producción, inventario, compras, pedidos, logística, caja, costos, reportes, personal y flota.
- **CRM de atención (`apps/crm`):** aplicación independiente de atención por WhatsApp, desplegada en `atencion.santacatalina.online`.
- **Contratos (`packages/contracts`):** tipos compartidos entre ERP y CRM.

Stack actual: Next.js 16 App Router, React 19, TypeScript estricto, Prisma 6 y PostgreSQL. El ERP usa el esquema PostgreSQL principal; el CRM administra exclusivamente el esquema `crm`. Existe un envoltorio Tauri en `src-tauri`, pero no es el núcleo de la aplicación web.

## Mapa del repositorio

```text
app/                         ERP: páginas, layouts y API Routes
  (auth)/login/              inicio de sesión
  (dashboard)/               panel operativo principal
  empleados/                 portal de personal y analítica
  api/                       backend HTTP del ERP
apps/crm/                    CRM de WhatsApp, Prisma y pruebas propios
components/                  UI reutilizable por dominio
config/                      configuración versionada no secreta
docs/modules/                documentación funcional por módulo
lib/                         reglas de negocio, autenticación y servicios
packages/contracts/          contratos ERP ↔ CRM
prisma/schema.prisma         modelo de datos vigente del ERP
prisma/migrations/           cambios estructurales desplegables
scripts/                     respaldo, migraciones de datos y verificaciones
scratch/, tmp/, backups/     material diagnóstico o histórico; no es fuente de verdad
src-tauri/                   empaquetado de escritorio
```

Alias TypeScript: `@/*` apunta a la raíz. El `tsconfig.json` raíz excluye `apps` y `packages`; cada workspace se valida con sus propios comandos.

## Mapa de módulos y archivos de entrada

| Área | UI principal | Backend y lógica | Modelos o documentación clave |
|---|---|---|---|
| Acceso y permisos | `app/(auth)/login`, layouts, `components/layout` | `lib/auth.ts`, `middleware.ts`, `lib/access-control.ts`, `lib/auth/` | `Empleado`, `RolEmpleado`, `Ubicacion` |
| Sedes | `app/(dashboard)/sedes` | `app/api/sedes`, `lib/sedes.ts` | `Ubicacion`; administración exclusiva de ADMIN, baja lógica y reactivación. No se cambia el tipo con registros asociados. |
| Producción | `app/(dashboard)/produccion*`, `components/produccion` | `app/api/produccion`, `app/api/lotes`, `lib/produccion`, `lib/services/produccion-insumos.ts`, `planificacion.service.ts` | `Producto`, `Presentacion`, `FichaTecnica`, `Lote`, `RequerimientoProduccion`, `docs/modules/produccion.md` |
| Stock e insumos | `insumos`, `conteos-insumos`, `productos` | APIs homónimas, `lib/insumos`, `lib/pedidos/stockPedido.ts` | `Insumo`, `InsumoProveedor`, `StockInsumo`, `MovimientoStock`, `StockProducto`, `MovimientoProducto`, `docs/modules/insumos.md` |
| Compras | `app/(dashboard)/compras` | `app/api/compras`, `lib/services/compras.service.ts`, `lib/compras` | `Compra`, `MovimientoStock`, `docs/modules/compras.md` |
| Pedidos y clientes | `pedidos`, `clientes`, `importar` | `app/api/pedidos`, `app/api/clientes`, `app/api/importar-*`, `lib/parsers`, `lib/pedidos` | `Cliente`, `Pedido`, `DetallePedido`, `docs/modules/pedidos.md`, `clientes.md` |
| Logística y flota | `app/(dashboard)/logistica`, `components/logistica`, `components/flota` | `app/api/rutas`, `entregas`, `logistica`, `flota`; `lib/services/clustering.ts` | `Ruta`, `Entrega`, `Vehiculo`, asignaciones, kilometrajes, vencimientos y mantenimientos |
| Caja y pagos | `app/(dashboard)/caja` | `app/api/caja`, `app/api/mercadopago`, `lib/services/caja.service.ts`, `lib/caja`, `lib/mercadopago*` | `MovimientoCaja`, `DepositoCaja`, auditoría, rendiciones, saldos y conceptos; `docs/modules/caja.md` |
| Costos y reportes | `costos`, `reportes` | `app/api/costos`, `app/api/reportes`, `lib/services/reportes*.ts`, `mermas-costos.ts` | gastos, mermas y configuración de reportes; `docs/modules/reportes.md` |
| Personal y nómina | `app/empleados`, `components/empleados`, analítica | `app/api/empleados`, `fichadas`, `liquidaciones`, `prestamos`, `licencias`; `lib/payroll`, `lib/rrhh`, servicios de RR. HH. | modelos desde `Empleado` hasta liquidaciones, cierres, sanciones y uniformes; `docs/modules/empleados.md` |
| CRM WhatsApp | `apps/crm/app/page.tsx`, `metrics`, `settings` | `apps/crm/app/api`, `apps/crm/lib`, `app/api/internal/crm` en el ERP | `apps/crm/prisma/schema.prisma`, `apps/crm/README.md`, `docs/crm-whatsapp-arquitectura.md`, `packages/contracts` |

La navegación visible del ERP se define en `components/layout/Sidebar.tsx`. Antes de crear una página o endpoint nuevo, verificar allí y en `lib/access-control.ts` cómo debe quedar expuesto y protegido.

## Reglas transversales que no deben romperse

### Autenticación y autorización

- NextAuth usa credenciales, bcrypt y sesiones JWT de 8 horas.
- En producción la sesión se comparte entre `app.santacatalina.online` y `empleados.santacatalina.online`; mantener alineadas las cookies de `lib/auth.ts`, `lib/auth/cookies.ts` y `middleware.ts`.
- El middleware protege páginas y API. Una API sin sesión debe responder JSON `401`, no HTML; sin permiso debe responder `403`.
- `ADMIN` conserva acceso total. Los demás accesos combinan permisos configurables, roles heredados y reglas operativas por ubicación.
- Los permisos de `RolEmpleado` son la fuente de verdad por módulo (incluidos Compras, Clientes, Pedidos, Logística, Flota y Reportes). El nombre histórico del rol sólo actúa como respaldo para cuentas aún no vinculadas a un registro de rol.
- Toda ruta sensible nueva debe evaluarse en `lib/access-control.ts` y cubrirse con sus pruebas.

### Sedes

- `/sedes` y `/api/sedes` administran fábricas y locales, exclusivamente para ADMIN. `/api/ubicaciones` conserva la consulta operativa de activas; sus escrituras requieren ADMIN y DELETE desactiva sin borrar relaciones. La desactivación conserva historial y asignaciones existentes; no cancela operaciones pendientes. El tipo no puede cambiar cuando existen registros asociados.

### Datos y migraciones

- La base vigente es PostgreSQL, no SQLite.
- `prisma/schema.prisma` y las migraciones son la fuente de verdad estructural. No editar una migración ya desplegada.
- Tras cambiar el schema, ejecutar `npx prisma generate` y crear/verificar la migración correspondiente.
- Antes de desplegar cambios de datos o estructura, ejecutar y verificar `npm run db:backup`. Nunca ejecutar `db:reset` sobre una base compartida o productiva.
- Mantener operaciones compuestas de caja, stock, compras, pedidos y nómina dentro de transacciones cuando deban ser atómicas.

### Fechas, dinero y cantidades

- El negocio opera con fecha local de Argentina. Evitar conversiones implícitas a UTC que desplacen el día; reutilizar las utilidades y patrones existentes del módulo.
- No introducir una nueva fórmula de costos, stock, presentaciones, horas o liquidaciones en la UI. La regla de negocio debe vivir en `lib/` y tener pruebas.
- Todo cambio efectivo de sueldo o valor de hora extra debe conservar su traza en `HistorialSalarial`; la actualización salarial y su auditoría deben ser atómicas.
- Respetar los movimientos protegidos y las trazas de auditoría de Caja. No borrar o reescribir movimientos financieros relacionados sin revisar `lib/caja` y sus relaciones Prisma.
- Los egresos de Mercado Pago se consultan por `payer.id` en `lib/mercadopago-egresos.ts` y se registran con saldo/auditoría en `lib/services/mercadopago.service.ts`. Cron y POST `/api/mercadopago/sincronizar` (ADMIN) comparten la lógica; Caja consulta al abrir y cada minuto visible para ADMIN. Se pagina sobre las últimas 48 h y se deduplica por `mpId` con bloqueo transaccional. Sólo pagos aprobados ARS desde `account_money` descuentan el total pagado, nunca el neto recibido por el destinatario. No cubre operaciones ausentes de Payments Search ni concilia pagos cargados manualmente sin ID de MP.
- Los cambios de stock y de producto deben conservar trazabilidad hacia compras, lotes o pedidos según corresponda.

### Importaciones y operaciones destructivas

- Las importaciones siguen el patrón **preview → validación → confirmación**. No saltar la vista previa ni confiar en datos de Excel sin normalizarlos.
- No usar scripts de `scratch/` o `tmp/` sobre datos reales sin leerlos completos y comprobar explícitamente la base de destino.
- Para borrados o correcciones masivas, crear respaldo, acotar el conjunto afectado y ofrecer primero una verificación de sólo lectura.

El diagnóstico de egresos MP está en POST `/api/mercadopago/diagnostico` (ADMIN) y `lib/mercadopago-diagnostico.ts`: consulta hasta 30 IDs sin escrituras. Caja permite seleccionar un CSV de settlement; sólo envía IDs con `REAL_AMOUNT` negativo. No confundir la consulta directa de un pago con su inclusión en Payments Search ni el campo `available_money` del reporte con `account_money` de Payments.

### CRM

- El CRM es una aplicación independiente y su Prisma sólo puede administrar el esquema PostgreSQL `crm`.
- Los IDs de empleados y clientes del ERP son referencias externas, no claves foráneas entre esquemas.
- El CRM consulta el contexto del cliente mediante las APIs internas del ERP; no debe obtener acceso directo al esquema principal.
- En producción valida la sesión compartida y los permisos `permisoAtencion` / `permisoAtencionAdmin`.
- Webhooks quedan fuera de la sesión de usuario, pero deben validar challenge/firma y deduplicar eventos.
- Los canales pueden usar Meta directo o YCloud. YCloud conserva su API Key y Webhook Signing Secret cifrados, valida `YCloud-Signature`, deduplica por ID de evento y usa el número E.164 para identificar el canal; nunca reutilizar su payload o autenticación como si fueran de Meta.
- Los secretos de Meta se cifran y nunca se devuelven al navegador. `CRM_MOCK_WHATSAPP=true` debe impedir contactos reales durante pruebas.
- Un número existente de WhatsApp Business sólo puede incorporarse mediante Embedded Signup en modo Coexistence; la activación exige `is_on_biz_app=true`, plataforma `CLOUD_API` y confirmación administrativa de continuidad de la app y dispositivos vinculados.
- El webhook de Coexistence procesa `history`, `smb_app_state_sync`, `smb_message_echoes` y `account_update`; una baja o reconexión invalida la confirmación de continuidad y desactiva el canal.
- Los mensajes salientes, incluidos los ecos enviados desde WhatsApp Business, limpian los pendientes sólo si no son anteriores al último mensaje entrante; las APIs además omiten contadores históricos incoherentes cuando la conversación ya fue respondida.
- Las etiquetas son compartidas, persisten mediante `Tag`/`ConversationTag` y cada alta o baja en una conversación deja un `ConversationEvent`. Las respuestas rápidas activas se consultan desde `QuickReply`; escribir `/` abre el selector y elegir una sólo inserta el texto en el editor, sin enviarlo automáticamente. Sólo `ADMIN` o `permisoAtencionAdmin` puede crear, editar, activar, desactivar o eliminar respuestas desde ese selector.
- La toma de conversación usa un `lockToken`, heartbeat y lease; los envíos requieren `clientMessageId` idempotente.
- Abrir/tomar una conversación reinicia su contador local de no leídos. Mientras el dueño mantiene el lease, los mensajes entrantes nuevos se marcan mediante `/api/conversations/[id]/read`; YCloud recibe además `markAsRead` con el último `wamid`, sin impedir la limpieza local si el proveedor falla. Los totales de bandeja y no leídos se consultan en `/api/conversations/counts` sobre todas las conversaciones visibles; nunca se calculan sobre el recorte de 100 tarjetas cargadas.
- La bandeja y el chat se ordenan por `providerTimestamp` (con `createdAt` sólo como respaldo). Los eventos tardíos de historial o ecos de Coexistencia nunca deben hacer retroceder `lastMessageAt`; la conversación abierta consulta mensajes por el endpoint liviano `/api/conversations/[id]/messages` sin sobrescribir el borrador del pedido.
- La ficha rápida del pedido vive en `Conversation` dentro de `crm`: fecha como `YYYY-MM-DD` local, dirección, modalidad, turno, estado de pago confirmado, observaciones, productos/presentaciones externas del ERP con cantidades e instantáneas descriptivas, y el ID externo/nombre instantáneo del local de retiro. Los productos configurables exigen una `VarianteProducto` activa del ERP seleccionada mediante botones; nunca admiten sabor libre y cada línea fotografía ID, código y nombre de la variedad. Las variedades de Elegidos sólo admiten la presentación `x8`; la cantidad acumula porciones de ocho unidades. Catálogo, puntos de retiro, dirección actual y pedidos históricos se consultan exclusivamente por APIs internas del ERP; el detalle de un pedido se muestra sólo si pertenece al cliente vinculado. Sólo el agente dueño del lease puede editar la ficha. `Agendado` fotografía la ficha en `ScheduledOrder` con idempotencia y auditoría, luego limpia el borrador; representa la carga manual en Excel y aún no crea un `Pedido` en el ERP. Las tarjetas del historial agendado abren el detalle completo de esa fotografía en un modal. El historial resuelve nombres de agentes por una API interna del ERP y conserva un respaldo visual si esa consulta falla.
- Los operadores sólo pueden listar y abrir conversaciones sin asignar o asignadas a sí mismos. La bandeja no selecciona un chat automáticamente; `Esc` cierra el activo y libera su lease. Abrir una conversación sin asignar intenta tomarla automáticamente mediante la operación atómica de claim. Los supervisores con `permisoAtencionAdmin` y `ADMIN` pueden ver todas y liberar una asignación, dejando siempre trazas de auditoría.
- Resolver una conversación conserva su asignación e historial, limpia el lease y deja auditoría. Sólo una conversación resuelta puede archivarse; las archivadas no aparecen en las bandejas, pero un mensaje entrante posterior las reabre automáticamente para el mismo agente asignado.
- `/metrics` y `/api/admin/metrics` son exclusivos de `ADMIN` o `permisoAtencionAdmin`. La métrica diaria principal cuenta contactos distintos con al menos un mensaje `INBOUND` por fecha local de Argentina, nunca cantidad de mensajes; el desglose por operador cuenta conversaciones distintas con mensajes `OUTBOUND` enviados desde el CRM.

## Forma de trabajo recomendada

Para cada cambio:

1. Identificar el área en el mapa y leer sus entradas, servicio, modelos relacionados y pruebas.
2. Buscar referencias por símbolo o ruta con `rg`; evitar recorrer carpetas no relacionadas.
3. Revisar primero contratos e invariantes, luego implementar backend/regla de negocio y finalmente UI.
4. Agregar o ajustar pruebas junto a la lógica en `lib/**/*.test.ts` o en el workspace correspondiente.
5. Ejecutar la validación mínima relevante y ampliar a build cuando el cambio cruce capas o afecte despliegue.
6. Revisar el diff para no incluir archivos de datos, dumps, secretos ni cambios ajenos.

La comunicación y los comentarios nuevos deben estar en español. El entorno principal es Windows/PowerShell. Usar commits convencionales (`feat:`, `fix:`, `docs:`, `refactor:`, etc.).

## Comandos de consulta y verificación

Desde la raíz:

```powershell
npm run test            # pruebas unitarias del ERP
npm run lint            # lint del ERP
npm run build           # Prisma generate + build completo del ERP
npx prisma validate     # valida el schema principal
npx prisma generate     # regenera el cliente principal
npm run db:backup       # respaldo previo a operaciones de datos/migraciones
npm run db:deploy       # aplica migraciones pendientes
```

Para el CRM, desde la raíz:

```powershell
npm run crm:test
npm run crm:lint
npm run crm:db:validate
npm run crm:build
```

Los comandos `crm:db:*` de la raíz fuerzan `schema=crm` aunque `DATABASE_URL`
apunte por defecto a `public`; no reemplazarlos por una ejecución directa del
Prisma del CRM contra la URL raíz. `crm:db:deploy` continúa requiriendo un
`npm run db:backup` verificado inmediatamente antes.

Variables esperadas, sin registrar valores: ERP usa `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, Google Maps, Mercado Pago y `CRON_SECRET`. El CRM usa su propio `DATABASE_URL`, URLs ERP/CRM, `NEXTAUTH_SECRET`, `CRM_MOCK_WHATSAPP` y `WHATSAPP_CONFIG_ENCRYPTION_KEY`. Consultar los `.env.example`; nunca leer ni exponer secretos salvo que la tarea lo requiera explícitamente.

## Cuándo mantener este contexto

Actualizar `AGENTS.md` si cambia cualquiera de estos puntos:

- aplicaciones, workspaces o responsabilidades de carpetas;
- base de datos, autenticación, dominios o estrategia de despliegue;
- módulos principales o ubicación de la lógica de negocio;
- invariantes de caja, stock, producción, pedidos, personal o CRM;
- comandos de instalación, prueba, respaldo, migración o build;
- estado de vigencia de la documentación enlazada.

No convertir este archivo en un inventario de cada endpoint o modelo. Debe seguir siendo un mapa breve que conduzca a la fuente exacta.
