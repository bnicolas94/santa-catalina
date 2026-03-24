import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { vehiculoId, kmRegistrado, observaciones, fecha } = data;

    if (!vehiculoId || !kmRegistrado) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
    if (!vehiculo) {
      return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });
    }

    // Validación crítica: No permitir km menores al actual
    if (parseInt(kmRegistrado) < vehiculo.kmActual) {
      return NextResponse.json({ error: `El kilometraje (${kmRegistrado}) no puede ser menor al actual (${vehiculo.kmActual})` }, { status: 400 });
    }

    // Usar transacción para asegurar la integridad
    const result = await prisma.$transaction([
      prisma.kilometrajeVehiculo.create({
        data: {
          vehiculoId,
          kmRegistrado: parseInt(kmRegistrado),
          observaciones,
          fecha: fecha ? new Date(fecha) : new Date(),
        },
      }),
      prisma.vehiculo.update({
        where: { id: vehiculoId },
        data: { kmActual: parseInt(kmRegistrado) },
      }),
    ]);

    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
