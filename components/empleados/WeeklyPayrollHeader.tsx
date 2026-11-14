interface Props {
    onClose: () => void
    pageMode?: boolean
}

export function WeeklyPayrollHeader({ onClose, pageMode = false }: Props) {
    return <div className="modal-header" style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-gray-200)', background: 'linear-gradient(135deg, white 0%, var(--color-gray-50) 100%)', flex: '0 0 auto' }}>
        <div>
            <h2 style={{ margin: 0, letterSpacing: '-0.02em' }}>Liquidación semanal</h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                Revisá jornadas, ajustes e importes antes de confirmar el pago.
            </p>
        </div>
        <button className={pageMode ? 'btn btn-outline' : 'btn btn-ghost btn-icon'} onClick={onClose}>{pageMode ? '← Volver a empleados' : '✕'}</button>
    </div>
}
