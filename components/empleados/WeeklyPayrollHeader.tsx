interface Props {
    onClose: () => void
}

export function WeeklyPayrollHeader({ onClose }: Props) {
    return <div className="modal-header" style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-gray-200)', background: 'linear-gradient(135deg, white 0%, var(--color-gray-50) 100%)' }}>
        <div>
            <h2 style={{ margin: 0, letterSpacing: '-0.02em' }}>Liquidación semanal</h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                Revisá jornadas, ajustes e importes antes de confirmar el pago.
            </p>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
    </div>
}
