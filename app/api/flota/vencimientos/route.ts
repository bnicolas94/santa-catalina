import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vehiculoId = searchParams.get('vehiculoId');

  try {
    const where = vehiculoId ? { vehiculoId } : {};
    const vencimientos = await prisma.vencimientoVehiculo.findMany({
      where,
      include: { vehiculo: true },
      orderBy: { fechaVencimiento: 'asc' },
    });
    return NextResponse.json(vencimientos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { vehiculoId, tipo, fechaVencimiento, kmVencimiento, kmAviso, observaciones, diasAviso } = data;

    if (!vehiculoId || !tipo || (!fechaVencimiento && !kmVencimiento)) {
      return NextResponse.json({ error: 'Falta vehículo, tipo o parámetro de vencimiento (fecha/km)' }, { status: 400 });
    }

    const vencimiento = await prisma.vencimientoVehiculo.create({
      data: {
        vehiculoId,
        tipo,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
        kmVencimiento: kmVencimiento ? parseInt(kmVencimiento) : null,
        kmAviso: kmAviso ? parseInt(kmAviso) : null,
        diasAviso: diasAviso ? parseInt(diasAviso) : 30,
        observaciones,
      },
    });

    return NextResponse.json(vencimiento, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
