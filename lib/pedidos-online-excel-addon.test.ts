import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const source = readFileSync(join(process.cwd(), 'public/office-pedidos/sync.js'), 'utf8')

type Operation = { id: string; externalId: string; operation: 'GUARDAR' | 'CANCELAR'; version: number; payload?: Record<string, unknown> }

async function runAddon(rows: unknown[][], operation: Operation, initialColumns = 20) {
    const header = ['Fecha', 'Nombre y Apellido', 'Pedido', 'Cantidad', 'Calle', 'Telefono', 'Horario', 'Entrega',
        'Op.', 'Pago', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'Columna1']
    if (initialColumns === 20) header.push('ID Google Online')
    const reads: { row: number; column: number; count: number; width: number }[] = []
    const acknowledgements: Record<string, unknown>[] = []
    let onReady: ((info: { host: string }) => Promise<void>) | undefined

    const sheet = {
        tables: { getItem: () => ({
            getHeaderRowRange: () => ({ rowIndex: 0, columnIndex: 0, get columnCount() { return header.length },
                get values() { return [header] }, load() {} }),
            getDataBodyRange: () => ({ rowIndex: 1, get rowCount() { return rows.length }, load() {} }),
            columns: { add: () => { header.push('ID Google Online'); rows.forEach(row => row.push('')) } },
            rows: { add: () => { rows.push(Array(header.length).fill('')) } },
        }) },
        getRangeByIndexes(row: number, column: number, count: number, width: number) {
            return {
                load(property: string) { if (property === 'values') reads.push({ row, column, count, width }) },
                get values() { return Array.from({ length: count }, (_, i) => rows[row + i - 1].slice(column, column + width)) },
                set values(matrix: unknown[][]) {
                    matrix.forEach((values, i) => values.forEach((value, j) => { rows[row + i - 1][column + j] = value }))
                },
                set numberFormat(_value: unknown) {},
                clear() { for (let i = 0; i < count; i++) for (let j = 0; j < width; j++) rows[row + i - 1][column + j] = '' },
            }
        },
    }
    const status = { textContent: '' }
    const elements: Record<string, unknown> = {
        token: { value: '' }, status, workbook: { textContent: '' }, save: { addEventListener() {} },
    }
    const context = { workbook: { name: 'Pedidos Santa Catalina ultimo - Copia.xlsx', load() {},
        worksheets: { getItem: () => sheet } }, sync: async () => {} }
    const storage = new Map([['santa-catalina-pedidos-online-token-v1', 'test-token']])
    runInNewContext(source, {
        Office: { HostType: { Excel: 'Excel' }, onReady: (callback: typeof onReady) => { onReady = callback } },
        Excel: { run: async (callback: (value: typeof context) => Promise<void>) => callback(context),
            ClearApplyTo: { contents: 'contents' } },
        document: { getElementById: (id: string) => elements[id] },
        localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) },
        fetch: async (_url: string, options: { method: string; body?: string }) => ({ ok: true,
            json: async () => options.method === 'GET'
                ? { activo: true, workbookName: 'Pedidos Santa Catalina ultimo - Copia.xlsx', operaciones: [operation] }
                : (acknowledgements.push(JSON.parse(options.body ?? '{}')), { state: 'APLICADO' }) }),
        setInterval() {},
    })
    assert.ok(onReady)
    await onReady({ host: 'Excel' })
    return { rows, header, reads, acknowledgements, status: status.textContent }
}

const payload = { fecha: '2026-11-12', nombre: 'PRUEBA SINCRONIZACIÓN', pedido: '48jyq 48clasicos 8zyh',
    cantidad: 13, calle: 'PRUEBA', telefono: '0000000000', horario: 'Mañana', entrega: '2026-11-12' }

test('reutiliza una fila libre con fecha precargada distinta sin leer todos los pedidos', async () => {
    const rows = Array.from({ length: 600 }, () => { const row = Array(19).fill(''); row[0] = 46324; row[1] = 'ocupada'; return row })
    rows[599][1] = ''
    const result = await runAddon(rows, { id: '1', externalId: 'PRUEBA-1', operation: 'GUARDAR', version: 1, payload }, 19)
    assert.equal(result.header[19], 'ID Google Online')
    assert.equal(result.rows.length, 600)
    assert.equal(result.rows[599][0], 46338)
    assert.equal(result.rows[599][1], 'PRUEBA SINCRONIZACIÓN')
    assert.equal(result.rows[599][19], 'GOOGLE:PRUEBA-1')
    assert.equal(result.acknowledgements[0].exito, true)
    assert.ok(result.reads.every(read => read.width === 1 || read.count <= 512))
})

test('agrega una fila si el tramo final está ocupado', async () => {
    const rows = Array.from({ length: 600 }, () => { const row = Array(20).fill(''); row[0] = 46324; row[1] = 'ocupada'; return row })
    const result = await runAddon(rows, { id: '2', externalId: 'PRUEBA-2', operation: 'GUARDAR', version: 1, payload })
    assert.equal(result.rows.length, 601)
    assert.equal(result.rows[600][19], 'GOOGLE:PRUEBA-2')
    assert.equal(result.acknowledgements[0].exito, true)
})

test('cancela el pedido vinculado sin borrar la fecha ni las fórmulas', async () => {
    const rows = [Array(20).fill('')]
    rows[0][0] = 46338
    rows[0][1] = 'PRUEBA SINCRONIZACIÓN'
    rows[0][8] = '=FORMULA()'
    rows[0][19] = 'GOOGLE:PRUEBA-3'
    const result = await runAddon(rows, { id: '3', externalId: 'PRUEBA-3', operation: 'CANCELAR', version: 2 })
    assert.equal(result.rows[0][0], 46338)
    assert.deepEqual(result.rows[0].slice(1, 8), ['', '', '', '', '', '', ''])
    assert.equal(result.rows[0][8], '=FORMULA()')
    assert.equal(result.rows[0][19], '')
    assert.equal(result.acknowledgements[0].exito, true)
})
