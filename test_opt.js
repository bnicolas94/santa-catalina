const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.cliente.count();
        console.log('Total clients:', count);

        const clientsWithCoords = await prisma.cliente.findMany({
            where: {
                latitud: { not: null },
                longitud: { not: null }
            },
            select: {
                id: true,
                nombreComercial: true,
                latitud: true,
                longitud: true,
                direccion: true
            },
            take: 10
        });

        console.log('Clients with coordinates:', clientsWithCoords.length);
        if (clientsWithCoords.length > 0) {
            console.log('Sample clients with coordinates:');
            console.log(JSON.stringify(clientsWithCoords, null, 2));
        } else {
            const sample = await prisma.cliente.findMany({ take: 5 });
            console.log('Sample clients (showing missing coords):');
            console.log(JSON.stringify(sample, null, 2));
        }

        // Test a sample optimization call if possible
        if (clientsWithCoords.length > 1) {
            const waypoints = clientsWithCoords.slice(0, 3).map(c => ({
                id: c.id,
                lat: c.latitud,
                lng: c.longitud
            }));

            console.log('--- Testing Optimization Logic Simulation ---');
            const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
            if (!GOOGLE_MAPS_API_KEY) {
                console.log('No GOOGLE_MAPS_API_KEY found in env');
                return;
            }

            const companyAddress = "Camino General Belgrano 7287, Gutierrez, Buenos Aires";
            const startParam = encodeURIComponent(companyAddress);
            const waypointsParam = waypoints.map(w => `${w.lat},${w.lng}`).join('|');

            const url = `https://maps.googleapis.com/maps/api/directions/json?` +
                `origin=${startParam}` +
                `&destination=${startParam}` +
                `&waypoints=optimize:true|${waypointsParam}` +
                `&key=${GOOGLE_MAPS_API_KEY}` +
                `&region=ar`;

            console.log('Requesting URL:', url.replace(GOOGLE_MAPS_API_KEY, 'HIDDEN'));
            
            const res = await fetch(url);
            const data = await res.json();
            console.log('Response Status:', data.status);
            if (data.status === 'OK') {
                console.log('Waypoint Order:', data.routes[0].waypoint_order);
            } else {
                console.log('Error Data:', JSON.stringify(data, null, 2));
            }
        }

    } catch (e) {
        console.error('Execution error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
