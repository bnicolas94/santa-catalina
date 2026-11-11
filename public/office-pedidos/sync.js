/* global Office, Excel */
(() => {
  'use strict';

  const API = '/api/pedidos-online-excel/device';
  const TOKEN_KEY = 'santa-catalina-pedidos-online-token-v1';
  const MARKER = 'ID Google Online';
  const POLL_MS = 30000;
  const input = document.getElementById('token');
  const status = document.getElementById('status');
  const workbookLabel = document.getElementById('workbook');
  let busy = false;
  let workbookName = '';

  function show(message) { status.textContent = message; }
  function safeText(value) {
    const text = String(value ?? '').trim();
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
  }
  function serial(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Fecha de pedido inválida.');
    const result = Date.parse(`${iso}T00:00:00Z`) / 86400000 + 25569;
    if (!Number.isInteger(result)) throw new Error('Fecha de pedido inválida.');
    return result;
  }
  function payloadValido(value) {
    if (!value || typeof value !== 'object' || !Number.isSafeInteger(value.cantidad) || value.cantidad <= 0) return false;
    return ['fecha', 'nombre', 'pedido', 'calle', 'telefono', 'horario', 'entrega']
      .every(key => typeof value[key] === 'string' && value[key].length > 0);
  }
  async function api(method, body) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error('Pegá la clave del complemento.');
    const response = await fetch(API, {
      method, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `El ERP respondió ${response.status}.`);
    return data;
  }
  function sameBook(expected) {
    return workbookName.normalize('NFC').toLowerCase() === expected.normalize('NFC').toLowerCase();
  }
  async function acknowledge(operation, success, error) {
    await api('POST', { id: operation.id, version: operation.version, exito: success, error });
  }

  async function applyOperations(operations) {
    const results = [];
    await Excel.run(async context => {
      const sheet = context.workbook.worksheets.getItem('2026');
      const table = sheet.tables.getItem('Pedidos2026');
      const header = table.getHeaderRowRange();
      header.load('values,rowIndex,columnIndex,columnCount');
      await context.sync();
      if (header.columnIndex !== 0 || header.rowIndex !== 0 || header.columnCount !== 19 && header.columnCount !== 20) {
        throw new Error('La tabla Pedidos2026 no tiene la estructura A:S esperada.');
      }
      const names = header.values[0].map(String);
      if (names[0] !== 'Fecha' || names[1] !== 'Nombre y Apellido' || names[2] !== 'Pedido' || names[19] && names[19] !== MARKER) {
        throw new Error('La estructura de columnas cambió; se detuvo la escritura.');
      }
      if (header.columnCount === 19) {
        table.columns.add(null, null, MARKER);
        await context.sync();
      }
      const body = table.getDataBodyRange();
      body.load('rowIndex,rowCount');
      await context.sync();
      if (body.rowCount < 1) throw new Error('La tabla de pedidos no tiene filas disponibles.');
      const first = body.rowIndex;
      const count = body.rowCount;
      const dates = sheet.getRangeByIndexes(first, 0, count, 1);
      const orderData = sheet.getRangeByIndexes(first, 1, count, 7);
      const markers = sheet.getRangeByIndexes(first, 19, count, 1);
      dates.load('values'); orderData.load('values'); markers.load('values');
      await context.sync();
      const dateValues = dates.values;
      const orderValues = orderData.values;
      const markerValues = markers.values;

      for (const operation of operations) {
        try {
          if (typeof operation.externalId !== 'string' || !operation.externalId || !['GUARDAR', 'CANCELAR'].includes(operation.operation)) {
            throw new Error('Operación del ERP inválida.');
          }
          const id = `GOOGLE:${operation.externalId}`;
          const found = markerValues.findIndex(row => row[0] === id);
          if (operation.operation === 'CANCELAR') {
            if (found >= 0) {
              sheet.getRangeByIndexes(first + found, 1, 1, 7).clear(Excel.ClearApplyTo.contents);
              sheet.getRangeByIndexes(first + found, 19, 1, 1).clear(Excel.ClearApplyTo.contents);
              markerValues[found][0] = '';
              orderValues[found] = ['', '', '', '', '', '', ''];
            }
            results.push({ operation, success: true });
            continue;
          }
          const payload = operation.payload;
          if (!payloadValido(payload)) throw new Error('Datos de pedido incompletos.');
          const date = serial(payload.fecha);
          const deliveryDate = serial(payload.entrega);
          let index = found;
          if (index < 0) {
            const free = i => !markerValues[i][0] && orderValues[i].every(cell => cell === '' || cell === null);
            index = dateValues.findIndex((row, i) => Math.round(Number(row[0])) === date && free(i));
            if (index < 0) index = dateValues.findIndex((row, i) => !row[0] && free(i));
            if (index < 0) throw new Error(`No hay una fila libre para ${payload.fecha}.`);
          }
          const rowIndex = first + index;
          if (found < 0 && !dateValues[index][0]) {
            const created = sheet.getRangeByIndexes(rowIndex, 0, 1, 1);
            created.values = [[date]];
            created.numberFormat = [['dd-mmm']];
            dateValues[index][0] = date;
          }
          const values = [[safeText(payload.nombre), safeText(payload.pedido), payload.cantidad,
            safeText(payload.calle), safeText(payload.telefono), safeText(payload.horario), deliveryDate]];
          const target = sheet.getRangeByIndexes(rowIndex, 1, 1, 7);
          sheet.getRangeByIndexes(rowIndex, 5, 1, 1).numberFormat = [['@']];
          target.values = values;
          sheet.getRangeByIndexes(rowIndex, 7, 1, 1).numberFormat = [['dd-mmm']];
          sheet.getRangeByIndexes(rowIndex, 19, 1, 1).values = [[id]];
          markerValues[index][0] = id;
          orderValues[index] = values[0];
          results.push({ operation, success: true });
        } catch (error) {
          results.push({ operation, success: false, error: error instanceof Error ? error.message : String(error) });
        }
      }
      await context.sync();
    });
    return results;
  }

  async function poll() {
    if (busy || !localStorage.getItem(TOKEN_KEY)) return;
    busy = true;
    try {
      const queue = await api('GET');
      if (!sameBook(queue.workbookName)) throw new Error(`Este libro es «${workbookName}». El destino configurado es «${queue.workbookName}».`);
      if (!queue.activo) { show('Sincronización pausada desde el ERP.'); return; }
      if (!queue.operaciones.length) { show(`Conectado · ${new Date().toLocaleTimeString('es-AR')} · sin pedidos pendientes`); return; }
      let results;
      try { results = await applyOperations(queue.operaciones); }
      catch (error) {
        const message = error instanceof Error ? error.message : 'Excel no pudo aplicar la operación.';
        results = queue.operaciones.map(operation => ({ operation, success: false, error: message }));
      }
      for (const result of results) await acknowledge(result.operation, result.success, result.error);
      const failed = results.filter(r => !r.success);
      show(failed.length ? `${failed.length} operación(es) con error: ${failed[0].error}`
        : `${results.length} operación(es) aplicadas · ${new Date().toLocaleTimeString('es-AR')}`);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Error de sincronización.');
    } finally { busy = false; }
  }

  Office.onReady(async info => {
    if (info.host !== Office.HostType.Excel) { show('Este complemento requiere Excel.'); return; }
    try {
      await Excel.run(async context => {
        context.workbook.load('name');
        await context.sync();
        workbookName = context.workbook.name;
      });
      workbookLabel.textContent = `Libro abierto: ${workbookName}`;
      if (localStorage.getItem(TOKEN_KEY)) show('Conectando con el ERP…');
      else show('Pegá la clave generada por el ERP.');
      document.getElementById('save').addEventListener('click', async () => {
        const token = input.value.trim();
        if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { show('La clave no tiene el formato esperado.'); return; }
        localStorage.setItem(TOKEN_KEY, token);
        input.value = '';
        try { await Office.addin.setStartupBehavior(Office.StartupBehavior.load); }
        catch { show('Clave guardada. No se pudo configurar el inicio automático; abrí el panel al iniciar Excel.'); }
        await poll();
      });
      await poll();
      setInterval(poll, POLL_MS);
    } catch (error) { show(error instanceof Error ? error.message : 'No se pudo iniciar el complemento.'); }
  });
})();
