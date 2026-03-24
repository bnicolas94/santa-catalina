import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        vencimientos: true,
      },
    });
    return NextResponse.json(vehiculos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const vehiculo = await prisma.vehiculo.create({
      data: {
        patente: data.patente.toUpperCase(),
        marca: data.marca,
        modelo: data.modelo,
        anio: parseInt(data.anio),
        kmActual: parseInt(data.kmActual) || 0,
        estado: data.estado || 'disponible',
        activo: data.activo !== undefined ? data.activo : true,
      },
    });
    return NextResponse.json(vehiculo, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
