import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PayrollService } from '@/lib/services/payroll.service'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const anio = parseInt(searchParams.get('anio') || new Date().getFullYear().toString())

        const empleados = await prisma.empleado.findMany({
            where: { activo: true },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                fechaIngreso: true
            }
        })

        const liquidacionesVacas = await prisma.liquidacionSueldo.findMany({
            where: {
                tipo: 'VACACIONES',
                estado: 'pagado',
                periodo: { contains: anio.toString() }
            },
            select: {
                id: true,
                empleadoId: true,
                periodo: true,
                totalNeto: true,
                fechaGeneracion: true,
                desglose: true
            }
        })

        const reporte = empleados.map(emp => {
            const history = liquidacionesVacas.filter(l => l.empleadoId === emp.id)
            
            // Calcular antigüedad y días que le corresponden
            let antiguedad = 0
            let diasTotales = 0
            
            if (emp.fechaIngreso) {
                const ingreso = new Date(emp.fechaIngreso)
                const finAnio = new Date(anio, 11, 31)
                antiguedad = finAnio.getFullYear() - ingreso.getFullYear()
                
                if (antiguedad < 5) diasTotales = 14
                else if (antiguedad < 10) diasTotales = 21
                else if (antiguedad < 20) diasTotales = 28
                else diasTotales = 35
            }

            const diasTomados = history.reduce((acc, curr: any) => {
                const dias = curr.desglose?.diasTrabajados || 0
                return acc + dias
            }, 0)

            return {
                id: emp.id,
                nombre: `${emp.nombre} ${emp.apellido || ''}`.trim(),
                fechaIngreso: emp.fechaIngreso,
                antiguedad,
                diasTotales,
                diasTomados,
                diasPendientes: Math.max(0, diasTotales - diasTomados),
                detalles: history.map((h: any) => ({
                    id: h.id,
                    fecha: h.fechaGeneracion,
                    dias: h.desglose?.diasTrabajados || 0,
                    monto: h.totalNeto,
                    goce: h.desglose?.fechaInicioGoce && h.desglose?.fechaFinGoce 
                        ? `${new Date(h.desglose.fechaInicioGoce).toLocaleDateString('es-AR')} al ${new Date(h.desglose.fechaFinGoce).toLocaleDateString('es-AR')}`
                        : 'No especificado'
                }))
            }
        })

        return NextResponse.json(reporte)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
