const { PlanificacionService } = require('./lib/services/planificacion.service');
const { prisma } = require('./lib/prisma');

async function run() {
    const fecha = '2026-04-18';
    console.log(`Llamando a getPlanificacionDiaria para ${fecha}...`);
    const data = await PlanificacionService.getPlanificacionDiaria(fecha);
    
    const turnos = Object.keys(data.necesidades);
    console.log('Turnos encontrados:', turnos);
    
    turnos.forEach(t => {
        const count = Object.keys(data.necesidades[t]).length;
        console.log(`Turno ${t}: ${count} productos con demanda.`);
    });

    const totalProductos = Object.keys(data.infoProductos).length;
    console.log(`Total productos en infoProductos: ${totalProductos}`);
    
    if (totalProductos > 0) {
        const firstKey = Object.keys(data.infoProductos)[0];
        console.log('Ejemplo infoProducto:', JSON.stringify(data.infoProductos[firstKey], null, 2));
    }
}
run().catch(console.error).finally(() => prisma.$disconnect());
