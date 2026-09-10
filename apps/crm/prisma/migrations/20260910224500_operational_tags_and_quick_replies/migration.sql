-- Etiquetas operativas iniciales compartidas por todos los agentes.
INSERT INTO "crm"."tags" ("id", "name", "color", "active", "created_at") VALUES
  ('tag-pedido-manana', 'Pedido nuevo mañana', '#F7C928', true, CURRENT_TIMESTAMP),
  ('tag-pedido-hoy', 'Pedido nuevo hoy', '#F64B52', true, CURRENT_TIMESTAMP),
  ('tag-pedido-nuevo', 'Pedido nuevo', '#53D720', true, CURRENT_TIMESTAMP),
  ('tag-importante', 'Importante', '#9064D8', true, CURRENT_TIMESTAMP),
  ('tag-falta-pago', 'Falta pago', '#DCA1E8', true, CURRENT_TIMESTAMP),
  ('tag-postulantes', 'Postulantes', '#8FB5C2', true, CURRENT_TIMESTAMP),
  ('tag-no-tomar-pedido', 'No tomar pedido', '#4BC7B2', true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Respuestas base: se insertan en el editor y el agente confirma el envío.
INSERT INTO "crm"."quick_replies" ("id", "shortcut", "title", "body", "active", "created_by_id", "created_at", "updated_at") VALUES
  ('quick-saludo', 'saludo', 'Saludo inicial', '¡Hola! Gracias por comunicarte con Santa Catalina. ¿En qué podemos ayudarte?', true, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('quick-datos-pedido', 'datos', 'Datos para agendar', 'Para agendar tu pedido, por favor indicanos la fecha, si es envío o retiro, la dirección o local y el turno: mañana, siesta o tarde.', true, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('quick-pago', 'pago', 'Solicitud de comprobante', 'Podés realizar la transferencia y enviarnos el comprobante por este medio. Apenas lo recibamos, confirmamos el pago.', true, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('quick-agendado', 'agendado', 'Pedido agendado', '¡Listo! Tu pedido quedó agendado. Muchas gracias.', true, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('quick-gracias', 'gracias', 'Agradecimiento', '¡Muchas gracias por elegir Santa Catalina!', true, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("shortcut") DO NOTHING;
