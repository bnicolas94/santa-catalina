import { prisma } from '@/lib/prisma'
import { fechaClaveRRHH, rangoDiaRRHH } from '@/lib/rrhh/fechas'
import { configurarJornadaRemota } from '@/lib/rrhh/resumen-jornada-remota'
import { resolverHorarioPlanificado } from '@/lib/rrhh/horarios'
import { cargarPlanHorarios } from '@/lib/services/horarios-empleado.service'

/** Consulta en lote las marcas de hoy de las personas habilitadas para fichar a distancia. */
export async function consultarTrabajadoresRemotos() {
    const ahoraServidor = new Date()
    const fecha = fechaClaveRRHH(ahoraServidor)
    const empleados = await prisma.empleado.findMany({
        where: { activo: true, fichadoRemotoHabilitado: true },
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        select: {
            id: true, nombre: true, apellido: true,
            horarioEntrada: true, horarioSalida: true,
            horasTrabajoDiarias: true, horasTrabajoSabado: true,
            turno: true,
        },
    })
    if (empleados.length === 0) return { fecha, ahoraServidor: ahoraServidor.toISOString(), empleados: [] }

    const ids = empleados.map(empleado => empleado.id)
    const [marcas, plan] = await Promise.all([
        prisma.fichadaEmpleado.findMany({
            where: { empleadoId: { in: ids }, fechaHora: rangoDiaRRHH(fecha) },
            orderBy: [{ fechaHora: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, empleadoId: true, fechaHora: true, tipo: true, origen: true },
        }),
        cargarPlanHorarios(ids, fecha, fecha),
    ])
    const marcasPorEmpleado = new Map(ids.map(id => [id, [] as typeof marcas]))
    for (const marca of marcas) marcasPorEmpleado.get(marca.empleadoId)?.push(marca)

    return {
        fecha,
        ahoraServidor: ahoraServidor.toISOString(),
        empleados: empleados.map(empleado => ({
            id: empleado.id,
            nombre: empleado.nombre,
            apellido: empleado.apellido,
            ...configurarJornadaRemota(empleado, resolverHorarioPlanificado(plan, empleado.id, fecha), fecha),
            marcas: marcasPorEmpleado.get(empleado.id) ?? [],
        })),
    }
}
