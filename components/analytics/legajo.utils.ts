export const ESTADOS_ASISTENCIA = [
    { value: 'TRABAJO', label: 'Trabajó / Presente' },
    { value: 'FRANCO', label: 'Franco' },
    { value: 'FERIADO', label: 'Feriado' },
    { value: 'ENFERMEDAD', label: 'Enfermedad' },
    { value: 'SIN_AVISO', label: 'Sin aviso' },
    { value: 'CON_AVISO', label: 'Con aviso' },
] as const

export function formatearFechaCivil(fecha: string): string {
    const civil = fecha.slice(0, 10)
    const partes = civil.split('-')
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha
}

export function textoEstadoAsistencia(status: string): string {
    if (status === 'VACACIONES') return 'Vacaciones'
    return ESTADOS_ASISTENCIA.find(estado => estado.value === status)?.label || status
}

export function tonoEstadoAsistencia(status: string): { backgroundColor: string; color: string; border: string } {
    const tonos: Record<string, { backgroundColor: string; color: string; border: string }> = {
        TRABAJO: { backgroundColor: '#e6f4ea', color: '#137333', border: '1px solid #ceead6' },
        FRANCO: { backgroundColor: '#f1f3f4', color: '#5f6368', border: '1px solid #dadce0' },
        FERIADO: { backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' },
        ENFERMEDAD: { backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #e9d5ff' },
        SIN_AVISO: { backgroundColor: '#fce8e6', color: '#c5221f', border: '1px solid #fad2cf' },
        CON_AVISO: { backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa' },
        VACACIONES: { backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' },
    }
    return tonos[status] || tonos.FRANCO
}

export function escaparHtml(valor: unknown): string {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
}
