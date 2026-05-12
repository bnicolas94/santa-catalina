const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Copying logic from utils/horas.ts
function calcularResumenDia(marcas, horasJornada = 8) {
    let milisegundosTrabajados = 0;
    const marcasOrdenadas = [...marcas].sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime());
    let entradaActual = null;
    for (const marca of marcasOrdenadas) {
        if (marca.tipo === 'entrada') {
            entradaActual = new Date(marca.fechaHora);
        } else if (marca.tipo === 'salida' && entradaActual) {
            const salida = new Date(marca.fechaHora);
            milisegundosTrabajados += (salida.getTime() - entradaActual.getTime());
            entradaActual = null;
        }
    }
    const horasTrabajadas = milisegundosTrabajados / (1000 * 60 * 60);
    return { horasTrabajadas: parseFloat(horasTrabajadas.toFixed(2)) };
}

function agruparFichadasPorDia(fichadas) {
    const grupos = {};
    fichadas.forEach(f => {
        const d = new Date(f.fechaHora);
        const fechaLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!grupos[fechaLocal]) grupos[fechaLocal] = [];
        grupos[fechaLocal].push(f);
    });
    return grupos;
}

async function main() {
    const emp = await prisma.empleado.findFirst({ 
        where: { nombre: { contains: 'Jeremias' } },
        include: { rolRel: true }
    })
    
    const fechaInicio = '2026-05-04'
    const fechaFin = '2026-05-10'
    
    const fichadas = await prisma.fichadaEmpleado.findMany({
        where: {
            empleadoId: emp.id,
            fechaHora: {
                gte: new Date(fechaInicio + 'T00:00:00'),
                lte: new Date(fechaFin + 'T23:59:59')
            }
        }
    })
    
    console.log(`Fichadas: ${fichadas.length}`)
    const grupos = agruparFichadasPorDia(fichadas)
    
    const [sy, sm, sd] = fechaInicio.split('-').map(Number)
    const [ey, em, ed] = fechaFin.split('-').map(Number)
    let current = new Date(sy, sm - 1, sd)
    const end = new Date(ey, em - 1, ed)
    
    let diasTrabajados = 0
    let totalHoras = 0
    
    while (current <= end) {
        const fStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
        const marcas = grupos[fStr] || []
        const resumen = calcularResumenDia(marcas)
        
        console.log(`- ${fStr}: Marcas=${marcas.length}, Horas=${resumen.horasTrabajadas}`)
        
        if (resumen.horasTrabajadas > 0) {
            diasTrabajados++
            totalHoras += resumen.horasTrabajadas
        }
        current.setDate(current.getDate() + 1)
    }
    
    console.log(`Total Días: ${diasTrabajados}, Total Horas: ${totalHoras}`)
}

main()
