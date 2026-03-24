import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vehiculoId = searchParams.get('vehiculoId');

  try {
    const where = vehiculoId ? { vehiculoId } : {};
    const mantenimientos = await prisma.mantenimientoVehiculo.findMany({
      where,
      include: { vehiculo: true },
      orderBy: { fecha: 'desc' },
    });
    return NextResponse.json(mantenimientos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { vehiculoId, tipo, fecha, taller, costo, descripcion, kilometraje } = data;

    if (!vehiculoId || !tipo || !fecha || !descripcion) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const mantenimiento = await prisma.mantenimientoVehiculo.create({
      data: {
        vehiculoId,
        tipo,
        fecha: new Date(fecha),
        taller,
        costo: parseFloat(costo) || 0,
        descripcion,
        kilometraje: kilometraje ? parseInt(kilometraje) : null,
      },
    });

    return NextResponse.json(mantenimiento, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
