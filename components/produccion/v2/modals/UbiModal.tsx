'use client'

import Link from 'next/link'

export function UbiModal({ onClose }: { onClose: () => void }) {
    return <div className="modal-overlay"><div className="modal" role="dialog" aria-modal="true" aria-label="Gestión de sedes">
        <div className="modal-header"><h2>Gestión de sedes</h2><button className="btn btn-ghost" onClick={onClose}>Cerrar</button></div>
        <div className="modal-body"><p>La administración de fábricas y locales está disponible en la sección Sedes para ADMIN.</p>
            <Link className="btn btn-primary" href="/sedes">Ir a Sedes</Link></div>
    </div></div>
}
