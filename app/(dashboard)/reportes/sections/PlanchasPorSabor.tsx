import type { ReportePedidosOnline } from '@/lib/reportes/pedidos-online'

type Sabor = ReportePedidosOnline['porSaborElegido'][number]
const cantidad = (valor: number) => valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })

export default function PlanchasPorSabor({ sabores, sinDetalle, desde, hasta }: {
    sabores: Sabor[]; sinDetalle: number; desde: string; hasta: string
}) {
    const total = sabores.reduce((suma, sabor) => suma + sabor.planchas, 0)

    return <div>
        <h4 style={{ marginTop: 0 }}>Planchas vendidas por sabor elegido</h4>
        <p>Pedidos entregados de Elegidos y Personalizados con <strong>Fecha Entrega del {desde} al {hasta}</strong>. Incluye Local y Online según los filtros de arriba.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 16 }}>
            <span><strong>{cantidad(total)}</strong> planchas con sabor identificado</span>
            <span><strong>{sabores.length}</strong> sabores vendidos</span>
        </div>
        {sinDetalle > 0 && <p>{cantidad(sinDetalle)} pedidos personalizados no tienen un detalle de sabores válido y quedan fuera de este desglose. Podés verlos en Datos pendientes.</p>}
        {sabores.length ? <div style={{ maxHeight: 560, overflow: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
                <thead><tr><th>Sabor elegido</th><th>Planchas vendidas</th><th>Sándwiches</th><th>Participación</th></tr></thead>
                <tbody>{sabores.map(sabor => <tr key={sabor.codigo}>
                    <td style={{ minWidth: 180 }}>{sabor.nombre}</td>
                    <td><strong>{cantidad(sabor.planchas)}</strong></td>
                    <td>{cantidad(sabor.sandwiches)}</td>
                    <td style={{ minWidth: 180 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div aria-hidden="true" style={{ flex: 1, height: 12, background: '#f3e6e6', borderRadius: 6 }}>
                            <div style={{ height: '100%', width: `${total ? sabor.planchas / total * 100 : 0}%`, background: '#c51b35', borderRadius: 6 }} />
                        </div>
                        <span style={{ minWidth: 52, textAlign: 'right' }}>{total ? cantidad(sabor.planchas / total * 100) : '0'}%</span>
                    </div></td>
                </tr>)}</tbody>
                <tfoot><tr style={{ fontWeight: 700, background: '#f4f0e9' }}><td>Total</td><td>{cantidad(total)}</td>
                    <td>{cantidad(sabores.reduce((suma, sabor) => suma + sabor.sandwiches, 0))}</td><td>100%</td></tr></tfoot>
            </table>
        </div> : <p>No hay planchas con sabor identificado para estos filtros.</p>}
        <small>Una plancha equivale a ocho sándwiches. El desglose cuenta ventas, aunque alguna ficha de insumos o precio siga pendiente.</small>
    </div>
}
