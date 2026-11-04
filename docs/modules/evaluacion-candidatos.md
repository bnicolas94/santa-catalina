# Evaluación de candidatos — Etapa 1

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
