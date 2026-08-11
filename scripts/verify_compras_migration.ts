import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type SnapshotRow = { tabla: string; filas: bigint; checksum: string }
type PostRow = { compras: bigint; movimientos_vinculados: bigint; gastos_vinculados: bigint }

const tablasHistoricas = [
    'movimientos_stock',
    'gastos_operativos',
    'movimientos_caja',
    'saldos_caja',
    'insumos',
    'stock_insumos',
    'proveedores',
]

function quoteIdentifier(identifier: string) {
    return `"${identifier.replaceAll('"', '""')}"`
}

async function snapshotTabla(tabla: string): Promise<SnapshotRow> {
    const nombre = quoteIdentifier(tabla)
    const [resultado] = await prisma.$queryRawUnsafe<Array<{ filas: bigint; checksum: string }>>(`
        SELECT
            COUNT(*)::bigint AS filas,
            md5(COALESCE(
                string_agg(
                    md5((to_jsonb(t) - 'id_compra')::text),
                    '' ORDER BY (to_jsonb(t) ->> 'id')
                ),
                ''
            )) AS checksum
        FROM ${nombre} t
    `)
    return { tabla, ...resultado }
}

async function main() {
    const snapshots = []
    for (const tabla of tablasHistoricas) snapshots.push(await snapshotTabla(tabla))

    const output: Record<string, unknown> = {
        historico: snapshots.map(row => ({
            tabla: row.tabla,
            filas: row.filas.toString(),
            checksum: row.checksum,
        })),
    }

    if (process.argv.includes('--post')) {
        const [post] = await prisma.$queryRaw<PostRow[]>`
            SELECT
                (SELECT COUNT(*) FROM "compras")::bigint AS compras,
                (SELECT COUNT(*) FROM "movimientos_stock" WHERE "id_compra" IS NOT NULL)::bigint AS movimientos_vinculados,
                (SELECT COUNT(*) FROM "gastos_operativos" WHERE "id_compra" IS NOT NULL)::bigint AS gastos_vinculados
        `
        output.nueva_estructura = {
            compras: post.compras.toString(),
            movimientos_vinculados: post.movimientos_vinculados.toString(),
            gastos_vinculados: post.gastos_vinculados.toString(),
        }
    }

    console.log(JSON.stringify(output, null, 2))
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => prisma.$disconnect())
