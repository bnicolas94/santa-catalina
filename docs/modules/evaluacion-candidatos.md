# Evaluación de candidatos — Etapa 1

## Etapa 2: pruebas prácticas

Los intentos nuevos fijan un `plan` versión 2 inmutable. Los intentos anteriores con `plan=null` conservan el circuito de demostración. El banco sólo se importa desde servidor: `lib/evaluacion-candidatos/banco.server.ts`. La proyección pública excluye soluciones y mensajes futuros. Cada ejercicio conserva ID, versión y contenido en el plan; editar el banco no cambia intentos iniciados.

La configuración del panel permite activar módulos, cambiar orden, cantidad de ejercicios y segundos. Los valores iniciales son 180/300/600/300/240 segundos (27 minutos). El ajuste individual de tiempo admite 100–300% y sólo afecta intentos futuros. La demostración administrativa funciona localmente sin registrar intentos. Para incorporar escenarios, agregar un fixture al banco con ID y versión nuevos, mensajes con IDs únicos y segundos de aparición, referencia, estado inicial y solución privada; ampliar el máximo de ejercicios en `validarConfig` si cambia el tamaño del banco.

El portal incorpora tipeo, cuatro planillas, doce conversaciones ficticias, cinco controles de detalle y cuatro situaciones de redacción. Las conversaciones incluyen datos completos, mensajes separados, cambios de cantidad/dirección/fecha, datos faltantes, dos productos, simultaneidad, una modificación posterior a la carga, contradicciones, comentarios irrelevantes e instrucciones especiales. Los mensajes de C3–C5 y C9 aparecen a los 30/90 segundos (se escala para duraciones cortas). C9 espera además la primera carga de su fila. El servidor reconstruye los mensajes por sesión; sus IDs impiden duplicarlos. Los indicadores de lectura del simulador son locales a la vista.

El reloj oficial empieza al pulsar Comenzar módulo. El autosave usa debounce de 800 ms, una solicitud de escritura en vuelo y control de revisión. Se conserva la identidad de filas al ordenar y filtrar; los IDs de pedido son inmutables. Se guardan respuestas, filtros, orden, marcas, cambios de celda, eventos recibidos y transiciones. El historial se limita a los últimos 2500 cambios por módulo. La grilla admite texto, números, validación de formato, copia/pegado de bloques tabulados y fórmulas simples de dos números o `SUMA(A1:A3)` sobre celdas numéricas sin fórmulas anidadas. No ejecuta código. Tab/Shift+Tab usan el orden de foco; Enter baja, Escape revierte la celda y Alt+flechas navega preservando las flechas de edición de texto. No hay selección múltiple con arrastre; el pegado de bloques cubre la carga tabular.

El lease del navegador dura 45 segundos y se renueva con latidos de 10 segundos. Una nueva carga de página genera otra credencial: puede ser necesario esperar a que venza el lease anterior. Una desconexión no pausa el reloj y los cambios sin confirmación permanecen en memoria de esa página; no se anuncia Guardado hasta recibir confirmación. El servidor admite 60 segundos de tolerancia al entregar; pasado ese plazo rechaza cambios y conserva el último progreso confirmado. La pantalla informa cómo solicitar intervención de Personal. La pausa/reanudación exige motivo y permite añadir 30–3600 segundos sin modificar respuestas históricas anteriores al evento. Sólo se interviene el último módulo iniciado; reabrirlo invalida sus métricas previas hasta un nuevo cierre.

Las métricas descriptivas de tipeo usan caracteres/5 para palabras por minuto y distancia de Levenshtein para errores finales; la exactitud es `100 × (1 - distancia / max(longitud original, longitud escrita))`. El tiempo incluye el tiempo transcurrido entre inicio y cierre menos pausas autorizadas. No se registra un keylogger ni se presenta un conteo de correcciones como si fuera confiable. No hay puntaje global, ranking ni IA; corresponden a la Etapa 3.

La migración `20261104180000_evaluaciones_practicas` agrega plan y lease al intento y porcentaje de tiempo al candidato. Antes de aplicarla: `npm run db:backup`, comprobar el respaldo y luego `npm run db:deploy`. No requiere dependencias nuevas. Tras migrar, crear un candidato desde `/evaluaciones-candidatos`, generar enlace, abrirlo en otro navegador, aceptar condiciones, recuperar sesión y completar cada módulo. El detalle administrativo muestra contenido asignado, respuestas, tablas, tiempos, métricas e historial; permite intervenir sesiones con motivo.

### Archivos de la Etapa 2

Creados:

- `lib/evaluacion-candidatos/tipos.ts`, `banco.server.ts`, `motor.ts`, `planilla.ts`, `sesion.server.ts`, `motor.test.ts`, `sesion.test.ts`.
- `components/evaluacion-candidatos/PlanillaSimulada.tsx`, `Ejercicios.tsx`, `RecorridoPractico.tsx`, `Configuracion.tsx`, `RevisionPractica.tsx`, `practicas.module.css`.
- `app/api/evaluacion/[token]/sesion/route.ts`.
- `app/api/evaluaciones-candidatos/configuracion/route.ts`.
- `app/api/evaluaciones-candidatos/[id]/sesiones/route.ts`.
- `prisma/migrations/20261104180000_evaluaciones_practicas/migration.sql`.

Modificados:

- `prisma/schema.prisma`.
- `app/api/evaluacion/[token]/route.ts`.
- `app/api/evaluaciones-candidatos/[id]/route.ts`.
- `app/evaluacion/[token]/page.tsx`.
- `app/(dashboard)/evaluaciones-candidatos/page.tsx`.
- `AGENTS.md` y este documento.

El módulo vive en el ERP y usa `permisoPersonal` (o ADMIN). Es independiente del historial de `/postulaciones` y de `Empleado`.

## Rutas

- `/evaluaciones-candidatos`: alta, búsqueda y seguimiento de candidatos, invitaciones, respuestas y archivo.
- `/api/evaluaciones-candidatos`: lista paginada, métricas y alta.
- `/api/evaluaciones-candidatos/[id]`: ficha y edición o archivo.
- `/api/evaluaciones-candidatos/[id]/invitaciones`: emisión individual.
- `/api/evaluaciones-candidatos/[id]/invitaciones/[invitacionId]`: revocación.
- `/evaluacion/[token]` y `/api/evaluacion/[token]`: portal público y progreso.

## Datos y seguridad

`CandidatoEvaluacion` guarda sólo los datos de contacto necesarios y observaciones internas. `InvitacionEvaluacion` conserva hash SHA-256 del token aleatorio de 256 bits; el enlace completo se devuelve una sola vez al emitirlo. `IntentoEvaluacion` es único por invitación. `RespuestaEvaluacion` tiene una fila por intento y módulo; `ResultadoEvaluacion` queda reservado y no se escribe en esta etapa.

El estado de invitación se deriva de revocación, vencimiento e inicio. El intento sólo pasa de `EN_PROGRESO` a `COMPLETADO`. Las operaciones públicas bloquean la fila de invitación durante la transacción para que la revocación, los guardados y el cierre no se adelanten entre sí. Un enlace revocado, vencido o de candidato archivado no permite leer ni escribir. Archivar revoca además los enlaces vigentes. La aceptación se registra al iniciar. Los módulos futuros pueden usar claves de módulo distintas de `DEMO` y su propia validación; la demo no tiene puntuación.

## Operación

1. Ejecutar `npm run db:backup` y verificar el respaldo antes de desplegar la migración.
2. Ejecutar `npm run db:deploy` (o dejar que `npm start` la aplique antes de iniciar Next.js).
3. Ingresar con permiso de Personal a `/evaluaciones-candidatos`, dar de alta un candidato y generar la invitación.
4. Copiar el enlace inmediatamente. Si se pierde, revocar el anterior y emitir otro.

`EVALUACION_INVITACION_DIAS` permite ajustar la vigencia entre 1 y 30 días; si no se define, son 7. El archivo de ejemplo de entorno muestra la variable. No hay eliminación automática de datos personales en esta etapa: el archivo es lógico y conserva los intentos. Una política de retención y eliminación deberá definirse antes de habilitar borrados.
