const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const liquidaciones = await prisma.liquidacionSueldo.findMany({
        where: { descuentosPrestamos: { gt: 0 } },
        include: { cuotasDescontadas: true, empleado: { include: { prestamos: { include: { cuotas: { orderBy: { numeroCuota: 'asc' } } } } } } }
    })

    console.log(`Encontradas ${liquidaciones.length} liquidaciones con descuento de prestamos.`);

    for (const liq of liquidaciones) {
        const sumaPagada = liq.cuotasDescontadas.reduce((acc, c) => acc + c.monto, 0);
        if (sumaPagada < liq.descuentosPrestamos) {
            console.log(`\nLiquidacion ID: ${liq.id} - Empleado: ${liq.empleado.nombre} ${liq.empleado.apellido} (${liq.periodo})`);
            console.log(`- Descuento registrado en recibo: $${liq.descuentosPrestamos}`);
            console.log(`- Suma de cuotas marcadas como pagadas: $${sumaPagada}`);
            
            // Faltan cuotas por marcar.
            const faltante = liq.descuentosPrestamos - sumaPagada;
            console.log(`- Diferencia: $${faltante} (Faltan marcar cuotas)`);

            // Buscar cuotas pendientes que se deberian haber marcado (tomando la primera de cada prestamo activo en esa fecha, pero para simplificar, busquemos cuotas pendientes actuales o que venzan cerca de esa liquidacion)
            // Ya que el error fue que NO se marcaron, siguen como pendientes!
            
            // Buscar una cuota por prestamo (excluyendo el prestamo que ya tiene cuota pagada en esta liquidacion)
            const prestamosPagadosEnLiq = liq.cuotasDescontadas.map(c => c.prestamoId);
            const prestamosActivos = liq.empleado.prestamos.filter(p => !prestamosPagadosEnLiq.includes(p.id) && p.estado === 'activo');
            
            let cuotasAArreglar = [];
            for (const prestamo of prestamosActivos) {
                // tomar la primera pendiente
                const pendiente = prestamo.cuotas.find(c => c.estado === 'pendiente');
                if (pendiente) cuotasAArreglar.push(pendiente);
            }
            
            let sumaAArreglar = cuotasAArreglar.reduce((acc, c) => acc + c.monto, 0);
            console.log(`- Cuotas pendientes encontradas que coinciden: $${sumaAArreglar} (${cuotasAArreglar.map(c => c.id).join(', ')})`);
            
            if (sumaAArreglar === faltante) {
                console.log(`[!] Podemos arreglarlo automaticamente.`);
                for (const c of cuotasAArreglar) {
                    await prisma.cuotaPrestamo.update({
                        where: { id: c.id },
                        data: {
                            estado: 'pagada',
                            fechaPago: liq.createdAt,
                            liquidacionId: liq.id
                        }
                    });
                    console.log(`    -> Cuota ${c.id} (Préstamo ${c.prestamoId}) marcada como pagada.`);
                }
            } else {
                console.log(`[WARNING] No cuadra exacto. Requerirá revisión manual.`);
            }
        }
    }
}
main().finally(() => prisma.$disconnect())
