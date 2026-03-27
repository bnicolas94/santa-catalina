require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) {
        console.error('❌ Error: GOOGLE_MAPS_API_KEY no encontrada en .env');
        return;
    }

    try {
        const clientes = await prisma.cliente.findMany({
            where: {
                OR: [
                    { latitud: null },
                    { longitud: null }
                ],
                direccion: { not: null }
            }
        });

        console.log(`🔍 Encontrados ${clientes.length} clientes sin coordenadas.`);

        for (const cliente of clientes) {
            console.log(`📍 Geocodificando: ${cliente.nombreComercial} (${cliente.direccion})...`);
            try {
                const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cliente.direccion)}&key=${GOOGLE_MAPS_API_KEY}&region=ar`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.status === 'OK' && data.results.length > 0) {
                    const { lat, lng } = data.results[0].geometry.location;
                    await prisma.cliente.update({
                        where: { id: cliente.id },
                        data: { latitud: lat, longitud: lng }
                    });
                    console.log(`✅ Éxito: ${lat}, ${lng}`);
                } else {
                    console.warn(`⚠️ Advertencia: Google respondió ${data.status} para "${cliente.direccion}"`);
                }
            } catch (err) {
                console.error(`❌ Error geocodificando ${cliente.id}:`, err.message);
            }
            // Pequeño delay para no saturar la cuota si son muchos (aunque el API rate es alto)
            await new Promise(r => setTimeout(r, 100));
        }

        console.log('🏁 Proceso finalizado.');
    } catch (e) {
        console.error('❌ Error general:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
