interface Props {
    cantidadResultados: number
    cantidadLiquidables: number
    cantidadSeguimientos: number
    confirmando: boolean
    guardandoBorrador: boolean
    borradorCargado: boolean
    onGuardarBorrador: () => void
    onConfirmar: () => void
    onClose: () => void
}

export function WeeklyPayrollFooter(props: Props) {
    return <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', position: 'sticky', bottom: 0, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', borderTop: '1px solid var(--color-gray-200)', boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.06)' }}>
        <div>
            {props.cantidadResultados > 0 && <button className="btn btn-outline" onClick={props.onGuardarBorrador} disabled={props.guardandoBorrador || props.confirmando}>
                {props.guardandoBorrador
                    ? 'Guardando...'
                    : props.borradorCargado
                        ? '✅ Información semanal al día'
                        : props.cantidadSeguimientos > 0
                            ? '💾 Guardar borradores y seguimientos'
                            : '💾 Guardar Borrador'}
            </button>}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-outline" onClick={props.onClose} disabled={props.confirmando}>Cerrar</button>
            <button className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', minWidth: '200px' }} onClick={props.onConfirmar} disabled={props.cantidadLiquidables === 0 || props.confirmando}>
                {props.confirmando ? 'Procesando...' : `Confirmar liquidaciones (${props.cantidadLiquidables})`}
            </button>
        </div>
    </div>
}
