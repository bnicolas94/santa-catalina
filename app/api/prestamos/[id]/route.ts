import { NextResponse } from 'next/server'

// Los préstamos afectan Caja y pueden quedar vinculados a liquidaciones.
// Hasta contar con una anulación trazable, se preserva el historial completo.
export async function DELETE() {
    return NextResponse.json(
        { error: 'Los préstamos no se eliminan. Esta protección evita desajustes con Caja y liquidaciones históricas.' },
        { status: 409 },
    )
}
