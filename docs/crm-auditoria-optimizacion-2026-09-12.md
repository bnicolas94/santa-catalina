# Auditoría y plan de optimización del CRM

Fecha: 12 de septiembre de 2026. Base revisada: commit `3ac0e9f` y archivos actuales del workspace.

## Resultado ejecutivo

La arquitectura independiente del CRM es adecuada y debe mantenerse. La mayor oportunidad no es cambiar otra vez sus colores: es conseguir una atención confiable, rápida y predecible, conservando la familiaridad de WhatsApp Web.

El orden recomendado es: corregir bandejas/borradores/envíos → completar medios y sincronización → simplificar pantallas → fortalecer pedidos y métricas → integrar creación de pedidos → IA supervisada.

### Alcance y límites

- Revisión de UI, CSS, APIs, modelos, bloqueos, webhooks YCloud/Meta, integración ERP y métricas.
- Ejecución de pruebas del CRM: **73 aprobadas, 0 fallidas**.
- Contraste con documentación oficial de YCloud y W3C.
- No se modificaron datos, credenciales, código operativo ni despliegues. Este documento es el único archivo creado por la auditoría.
- Los hallazgos de comportamiento se identificaron en código; no se reprodujeron todos en una sesión productiva autenticada. No se midieron latencias, carga real ni contraste visual completo. Las metas siguientes son propuestas, no resultados medidos.

## Avance posterior a la auditoría

- Paso 1 (A01) implementado en el workspace: Nuevas y su contador consultan conversaciones activas sin dueño, incluidos registros históricos abiertos o en espera. Los entrantes conservan el estado sin asignar hasta la toma; las tarjetas identifican esos chats como Sin asignar.
- Validación: 77 pruebas unitarias aprobadas, lint de archivos afectados y compilación del CRM correctos. Las pruebas de persistencia verifican las mutaciones del webhook mediante un cliente simulado; no sustituyen una prueba de concurrencia contra PostgreSQL ni una prueba productiva.
- Sin migraciones, correcciones masivas de datos ni despliegue en este paso.

## 1. Lo que conviene conservar

- Aplicación separada del ERP, contratos compartidos y consultas mediante APIs internas.
- Aislamiento del esquema `crm`, credenciales cifradas y validación de firmas de webhooks.
- Toma atómica de conversación y lease para impedir respuestas cruzadas.
- Asignación persistente por operador, supervisión global y auditoría.
- Catálogo y variedades estructurados; Elegidos en porciones x8, sin sabor libre.
- Fotografía histórica al marcar Agendado, sin sobrescribir pedidos anteriores.
- Respuestas rápidas con `/`, que insertan texto y nunca envían sin confirmación del operador.
- Familiaridad visual: panel blanco, mensajes salientes verde claro, fondo cálido y etiquetas de color.

## 2. Hallazgos prioritarios

P0: riesgo directo de perder una consulta, un borrador o interpretar incorrectamente un envío. P1: impacto importante en operación, lectura o información. P2: mejora de eficiencia y evolución.

### A01 — Chats sin operador que dejan de aparecer en Nuevas · P0

**Evidencia:** `apps/crm/lib/whatsapp/webhook.ts`, `persistLiveMessage`, crea una conversación `UNASSIGNED` y luego, en el mismo procesamiento entrante, actualiza su estado a `OPEN` si la fecha del mensaje no es anterior a `lastMessageAt`. No exige `assignedToId`. `apps/crm/lib/conversations/listing.ts` define Nuevas exclusivamente por `status: UNASSIGNED`.

**Consecuencia:** un contacto nuevo puede tener `assignedToId=null` y estado `OPEN`; no aparece en Nuevas aunque nadie lo haya tomado. Esto no demuestra que todas las discrepancias históricas tengan esa causa, pero sí identifica un defecto concreto.

**Propuesta:** definir Sin asignar por la asignación real y alinear las transiciones: sin dueño → sin asignar; con dueño y entrante → pendiente de respuesta. Mantener el historial importado separado de la cola operativa, sin archivar masivamente sin preview.

**Aceptación:** una consulta nueva aparece para operadores disponibles; dos agentes que la abren simultáneamente obtienen un único propietario; el contador y la lista coinciden.

### A02 — Borradores vulnerables al cambiar filtro, chat o cerrar con Esc · P0

**Evidencia:** en `apps/crm/app/page.tsx`, el efecto de apertura borra `draft` y reinicia la ficha; depende de `refreshList`, cuya identidad cambia con filtro/búsqueda. El autoguardado espera 450 ms y su limpieza cancela ese temporizador. `selectConversation` libera el lease sin esperar que el borrador pendiente se guarde. `closeConversation` borra el texto.

**Consecuencia:** cambiar de filtro/búsqueda puede volver a inicializar el chat abierto. Cambiar de chat inmediatamente después de editar puede descartar cambios aún no enviados al servidor. El texto del mensaje tampoco se conserva por conversación.

**Propuesta:** separar estado de bandeja y chat; guardar antes de abandonar; borrador de mensaje por conversación y operador, persistido en servidor si se desea continuidad entre equipos. Mostrar Guardando/Guardado/Error con reintento. Agregar versión del borrador para rechazar escrituras antiguas que lleguen fuera de orden.

**Aceptación:** escribir, cambiar filtro, cerrar con Esc y volver no pierde información; una caída de red no muestra falsamente Guardado.

### A03 — Envíos fallidos y reintentos poco confiables · P0

**Evidencia:** `sendMessage` genera un `clientMessageId` nuevo en cada envío. `sendConversationText` limpia pendientes y actualiza `lastOutboundAt` antes de que el proveedor confirme. La UI muestra `✓✓` para cualquier mensaje OUTBOUND, incluso FAILED/QUEUED, cambiando sólo el color para READ.

**Consecuencia:** un intento fallido puede parecer respondido y reducir pendientes. Si el proveedor aceptó el envío pero la respuesta HTTP se perdió, un reintento manual con nuevo ID puede repetir el texto. La idempotencia local actual no equivale a entrega exactamente una vez en el proveedor.

**Propuesta:** estados visibles: enviando, aceptado/enviado, entregado, leído y fallido. Conservar el ID del intento y reconciliar estados por webhook antes de reintentar un resultado incierto. Validar el conflicto de `clientMessageId` contra conversación/agente; actualmente el servicio retorna un registro existente antes de esas comprobaciones. Para mayor confiabilidad, introducir una bandeja de salida durable con worker y reintentos controlados.

**Aceptación:** caída antes/después de aceptación del proveedor, webhook adelantado y reintento no generan envíos inadvertidos; FAILED no se cuenta como respuesta exitosa.

### A04 — Bandeja e historial truncados · P1

**Evidencia:** listado limitado a 100 conversaciones sin cursor ni Cargar más. Mensajes limitados a los últimos 300 por `createdAt` y luego ordenados por fecha del proveedor. Historial agendado limitado a 20 y contexto ERP a cinco pedidos recientes.

**Consecuencia:** conversaciones e historial quedan inaccesibles mediante navegación normal. El historial tardío puede ocupar el recorte de 300 aunque no sea el más reciente en tiempo real; ordenar después de recortar no corrige el conjunto seleccionado.

**Propuesta:** paginación por cursor con orden determinista y respaldo temporal consistente; cargar mensajes anteriores al subir preservando la posición del scroll. Separar lista, mensajes e historial de pedidos. No resolver aumentando indefinidamente los límites.

### A05 — Conectado y Disponible son indicadores estáticos · P1

**Evidencia:** `page.tsx` siempre muestra Conectado y Disponible. Fallos periódicos de lista/mensajes se silencian. `/api/health` devuelve ok sin comprobar DB, cola ni integración.

**Propuesta:** mostrar estado de conexión de la pantalla, última sincronización exitosa y reconectando; distinguirlo del estado del canal/proveedor. Panel admin de último webhook, pendientes, fallidos y demora de procesamiento. Mantener un health de proceso liviano y agregar readiness/diagnóstico administrativo con información restringida.

### A06 — Sincronización con demasiadas consultas completas · P1

**Evidencia:** lista cada 4 s, hasta 300 mensajes cada 2 s, contadores cada 15 s y heartbeat cada 25 s. Aproximadamente 51,4 solicitudes por minuto por pestaña con chat abierto, antes de lecturas, envíos y otras acciones. Algunas actualizaciones no previenen respuestas fuera de orden. Contadores recuperan todas las conversaciones visibles y agregan en JavaScript.

**Propuesta:** primero consultas incrementales y solicitudes cancelables; contadores agregados en PostgreSQL; actualización optimista reconciliada; caché de catálogo/locales/nombres respetando permisos y caducidad. Después evaluar SSE con reconexión y recuperación de eventos, autorizado por operador. No asumir que WebSockets, Redis o una nueva plataforma son obligatorios sin medir carga. Una pestaña oculta debe reducir trabajo, sin perder eventos al volver.

**Aceptación:** consultas y bytes transferidos medidos antes/después; pendientes consistentes; ningún evento perdido tras reconectar.

### A07 — Ficha inaccesible en pantallas chicas o con zoom · P1

**Evidencia:** `globals.css` oculta `.contextPanel` por debajo de 1260 px y también en móvil. El botón Información sólo cambia `showContext`: no proporciona una vista alternativa del pedido. Hay anchos mínimos simultáneos que pueden exceder el viewport.

**Propuesta:** panel lateral redimensionable en escritorio y cajón/pantalla Pedido en notebooks/móvil. Nunca ocultar la función de agendar por el ancho o el zoom. Probar 1366×768, 1536×864, 1920×1080, zoom 125/150/200 % y móvil.

El criterio de reflow de W3C orienta a mantener acceso al contenido y funciones al reducir el área disponible; todavía no se realizó una certificación de conformidad. [W3C: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

### A08 — Botones que prometen funciones aún no implementadas · P1

**Evidencia:** buscar dentro del chat, llamar, emoji y adjuntar archivo no tienen handler. Transferir aparece deshabilitado para operadores. El acceso a configuración se muestra también a usuarios que no pueden administrarla.

**Propuesta:** implementar o retirar los controles sin acción. Adjuntos y búsqueda son prioritarios; llamada debe aclarar si abre una llamada externa o utiliza una integración soportada. Configuración sólo para supervisión. Transferencia explícita con destinatario y motivo; no confundir cerrar ventana, transferir, resolver y archivar.

### A09 — Medios y mensajes especiales incompletos · P1

**Evidencia:** hay visualización de imágenes, pero audio/video/documento sólo muestran una leyenda. Ubicación/contactos se clasifican, aunque no se conservan todos sus datos para renderizarlos. Reacciones y respuestas citadas no tienen representación completa. Sólo se guarda `image.link` como `mediaUrl`. Las fotos dependen del archivo temporal del proveedor, sin almacenamiento propio durable.

**Propuesta:** reproductor de audios, descarga de comprobantes/PDF, ubicación utilizable en la ficha, respuesta citada y galería privada de adjuntos. Carga diferida de imágenes y vista ampliada dentro del CRM con zoom/descarga. Diferenciar archivo recibido sin enlace, expirado, sin permiso y error transitorio. Evaluar almacenamiento de objetos privado con retención explícita, permisos por conversación y backups de archivos; no usar el filesystem efímero del servicio Railway.

YCloud documenta enlaces de medios temporales y descarga autenticada dentro de 30 días. Eso hace útil conservar adjuntos relevantes, pero no justifica almacenamiento indefinido por defecto. [YCloud: imágenes entrantes](https://docs.ycloud.com/reference/whatsapp-inbound-message-webhook-examples).

### A10 — Recepción sin recuperación durable propia · P1

**Evidencia:** YCloud se procesa completo dentro de una transacción de la petición. `WebhookReceipt` conserva hash/ID, no payload recuperable. Si falla la transacción, tampoco queda el recibo; los campos attempts/lastError no constituyen hoy una cola de reintentos.

**Propuesta:** verificar firma → guardar evento durable y deduplicado → responder 2xx → procesar con worker. Retención corta y protección de payloads; estados pending/processing/processed/failed, backoff y reintento admin. Nunca responder éxito antes de que el evento quede guardado.

YCloud pide respuesta rápida y documenta reintentos finitos; por eso no conviene depender exclusivamente de que vuelva a enviar. [YCloud: webhooks](https://docs.ycloud.com/reference/configure-webhooks).

### A11 — Contactos YCloud y Coexistencia parcialmente integrados · P1

**Evidencia:** `parseYCloudWebhook` contempla inbound, status, echoes e history; devuelve `syncedContacts: []` y no admite `whatsapp.smb.app.state.sync`. Meta directo sí tiene procesamiento de contactos sincronizados.

**Propuesta:** incorporar el evento documentado por YCloud para altas/cambios/bajas de contactos; una baja de libreta no debe borrar pedidos ni conversación. Mantener separados nombre WhatsApp, nombre elegido para atención y cliente ERP. No prometer que etiquetas, leídos, fotos y todas las funciones de WhatsApp Web tengan espejo exacto por API; verificar cada capacidad con el proveedor. [YCloud: eventos de contactos](https://docs.ycloud.com/reference/webhook-events-payloads).

### A12 — Métricas que pueden alterar conclusiones · P1

**Evidencia:** consultas de operadores/respondidas incluyen OUTBOUND sin filtrar FAILED/QUEUED; respondidas exige inbound/outbound en el período, pero no que el outbound sea posterior al inbound. Resueltas se cuenta con `resolvedAt`, que una nueva entrada puede limpiar. Reclamos se cuenta por etiquetas que siguen asociadas: al quitar una, el dato histórico puede desaparecer.

**Propuesta:** contar respuestas exitosas y vinculadas temporalmente a la consulta; contar cierres y reclamos mediante eventos históricos/casos, no sólo el estado actual. Definir ventanas y exclusiones de pruebas/historial importado. Mostrar alcance de atribución: mensajes del teléfono no identifican automáticamente al empleado que los envió.

La métrica Personas que escribieron por día usa correctamente contactos distintos por fecha Argentina. No equivale a personas únicas del período ni a nuevas sesiones de atención. Conservar ese dato principal y agregar sesiones como métrica separada si se define cuándo empieza y termina una.

### A13 — Accesibilidad y mantenimiento visual · P2

**Evidencia:** fuente principal de mensajes 14 px; varios detalles útiles de ficha/variedades siguen entre 8 y 11 px. Los modales declaran `aria-modal` pero no implementan confinamiento/restauración de foco. CSS contiene capas de diseño antiguo, rediseño WhatsApp y aumentos de fuente.

**Propuesta:** modo cómodo predeterminado: mensajes 15–16 px, datos operativos 13–14 px, textos auxiliares 12 px cuando corresponda; densidad configurable. Botones principales de 40–44 px como elección de comodidad, no requisito universal de WCAG. Selecciones con texto/icono y color, labels asociados y errores cerca del campo. Un componente compartido de modal con foco correcto. Unificar tokens tipográficos, superficies, espaciado y breakpoints.

W3C establece tamaño mínimo de objetivo 24×24 CSS px con excepciones y espaciado; las fuentes propuestas aquí son criterio de diseño, no un mínimo exigido por esa norma. [W3C: tamaño de controles](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [W3C: modales](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

### A14 — Dependencia del ERP en cada guardado y vínculo difícil de corregir · P2

**Evidencia:** cada PUT de ficha consulta catálogo ERP completo y, para retiro, locales. La resolución de teléfono lee todos los clientes activos con teléfono antes de comparar en memoria. La UI ofrece candidatos cuando hay coincidencias, pero no un buscador general o desvincular/corregir vínculo.

**Propuesta:** catálogo versionado/caché autorizada con revalidación; evitar consultas completas cuando sólo cambia dirección/turno, conservando validación de referencias en servidor. Teléfono normalizado/indexado en ERP cuando se migre con backup y preview. Buscar cliente por código/nombre/teléfono, corregir vínculo con auditoría y no autovincular ante ambigüedad. Contexto del cliente debe ignorar respuestas tardías de un chat anterior.

## 3. Propuesta de pantallas y flujo del operador

### Bandeja

- Filtros principales: Todos, Míos, Sin asignar, Esperan respuesta, Esperan al cliente y Resueltos. No usar No leídos como sinónimo de necesitan respuesta.
- Filtros adicionales: etiqueta, pedido para hoy/mañana, reclamo y operador para admin.
- Contadores explícitos y coherentes con la consulta; historial importado no debería simular carga de trabajo nueva.
- Cada tarjeta: nombre, último mensaje útil, cantidad pendiente, dueño y tiempo de espera. Evitar duplicar información irrelevante.
- Notificación sonora opcional, aviso de mensajes nuevos y botón Volver al último mensaje sin mover el scroll mientras se lee historial.
- Orden WhatsApp por reciente como predeterminado; orden Más antiguos sin respuesta como herramienta operativa separada.

### Chat

- Cabecera simple: cliente, dueño, etiquetas y menú de acciones reales.
- Estados de envío comprensibles y reintento seguro.
- Búsqueda en historial, citas, copiar texto y medios compatibles.
- Notas internas distinguibles de mensajes al cliente, con editor que evite envíos accidentales.
- Esc conserva borradores y cierra la ventana; no libera la asignación del cliente.
- Atajos útiles y documentados; evitar que `/` tenga significados contradictorios entre búsqueda y editor.

### Pedido

- Pestañas Pedido / Cliente / Historial o secciones plegables; pedido primero durante el agendado.
- Productos frecuentes con botones y sabores estructurados; x8 TOM ×2 → 16 unidades visible junto al total del pedido.
- Resumen siempre accesible: productos/unidades, fecha, modalidad/destino, turno y pago manual.
- Fecha con día de semana completo; advertir fecha pasada sin bloquear casos válidos por una regla inventada.
- Dirección del ERP como sugerencia con procedencia visible y confirmación para cada entrega; no asumir que siempre es la misma.
- Mensaje de confirmación generado desde la ficha e insertado para revisión, nunca enviado automáticamente.
- Acciones separadas: Guardar ficha, Copiar para Excel, Marcar agendado. Agendado conserva su significado actual hasta integrar ERP.
- Repetir pedido desde historial carga un nuevo borrador; no copia fecha ni pago, y revalida productos/locales.

### Supervisión

- Tablero con Personas que escribieron hoy, Esperan respuesta, Más antiguo sin atender, operadores y pedidos.
- Transferir/reasignar con destinatario explícito, auditoría y manejo de ausencia/fin de turno. Resolver la continuidad de clientes asignados a un operador ausente sin dar acceso global a todos.
- Reclamos estructurados: motivo, gravedad, responsable, estado y resolución. IA podrá sugerir, no reemplazar la clasificación verificable.
- Salud del canal y cola de fallos en una vista administrativa separada de la pantalla del operador.

## 4. Métricas a incorporar

1. Personas distintas que escribieron por día Argentina: principal, ya existe; distinguirla de mensajes y de clientes únicos del período.
2. Pendientes de primera respuesta y antigüedad del más viejo.
3. Tiempo de primera respuesta: mediana y percentil 90, con definición de horario laboral y origen de la respuesta.
4. Conversaciones atendidas por operador, basadas en respuestas exitosas; no usar cantidad de mensajes como único indicador de productividad.
5. Pedidos agendados por operador y conversión sobre una cohorte bien definida.
6. Fichas incompletas/abandonadas y campos que más demoran el agendado.
7. Reclamos por motivo, casos cerrados y tiempo de resolución.
8. Volumen por hora, nuevos/recurrentes y recurrencia de pedidos.
9. Fallos de envío/medios, demora de webhook y estado de sincronización.

Los KPI necesitan definición visible, período, exclusiones y enlace para abrir los casos que explican el número. Evitar comparar operadores sin contemplar horario, carga y complejidad.

## 5. Camino hacia creación de pedidos ERP

No hace falta abandonar la aplicación independiente. El CRM debe seguir enviando comandos al ERP mediante APIs internas autorizadas.

1. Consolidar identificación de cliente y dirección confirmada.
2. Preview de pedido con precios/promociones/envío/totales calculados por el ERP, no fórmulas duplicadas en CRM.
3. Confirmación del operador sobre esa preview vigente, con ID idempotente.
4. ERP crea el pedido con sus transacciones, validaciones, stock y trazas habituales.
5. CRM guarda referencia externa y muestra resultado/historial; ante timeout consulta el resultado antes de crear nuevamente.
6. Pago marcado en atención sigue siendo una marca manual: no acredita Caja ni valida transferencia automáticamente. La futura conciliación debe ser una operación aparte.

## 6. Plan recomendado por etapas

| Etapa | Entregables | Condición para avanzar |
|---|---|---|
| 1. Estabilidad operativa | A01–A03, coherencia de pendientes y pruebas de concurrencia/borradores | Consultas y datos no se pierden; envíos fallidos no aparentan éxito |
| 2. Navegación y medios | Paginación, historial temporal correcto, audio/documentos, estado real de sync | Acceso a todos los chats y adjuntos compatibles |
| 3. UI cómoda | Tipografía, panel Pedido responsive, búsqueda, acciones reales y scroll probado | Operadores completan un pedido sin errores en sus equipos habituales |
| 4. Supervisión y rendimiento | KPI corregidos, transferencia/ausencias, diagnóstico, incremental/cola durable | Datos explicables y comportamiento medido bajo carga |
| 5. ERP e IA | Preview/confirmación de pedido; sugerencias de reclamos con revisión humana | Ninguna duplicación de pedidos, dinero o stock; trazabilidad completa |

Las etapas pueden dividirse en entregas pequeñas. No se propone una reescritura total ni se estiman plazos sin medir y probar los cambios.

## 7. Verificación necesaria

- Pruebas PostgreSQL de dos agentes tomando/enviando/agendando simultáneamente.
- Pruebas de navegador de scroll de bandeja/chat/ficha/configuración/métricas/modales.
- Cambio rápido A→B→A con respuestas HTTP tardías; cambios de filtro con texto/ficha abiertos.
- Guardado pendiente + Esc, cambio de chat, refresh, expiración de sesión y pérdida de lease.
- Mensaje entrante → eco → historial tardío → leído; estados entregado/leído fuera de orden.
- Timeout de envío después de aceptación; reintento sin duplicar ni descontar pendientes erróneamente.
- Archivar/resolver/reabrir conservando asignación, historial y métricas históricas.
- Archivos compatibles, vencidos, sin enlace, sobredimensionados, dominios ajenos y usuario sin permiso.
- Métricas con medianoche Argentina, FAILED, etiquetas retiradas, cierres/reaperturas y mensajes desde teléfono.
- Pruebas en entorno descartable o fixtures seguros, sin seed ni reset sobre producción. Para cualquier futura corrección masiva o migración: backup verificado y preview del conjunto afectado.

## Siguiente paso concreto

Empezar por **bandejas coherentes, protección de borradores y estados/reintentos de envío**, acompañados de pruebas de navegador. Es el cambio que más confianza aporta antes de agregar nuevas funciones o IA.
