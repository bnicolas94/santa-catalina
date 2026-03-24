import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [totalVehiculos, vehiculosActivos, vencimientos, vehiculos] = await Promise.all([
      // @ts-ignore
      prisma.vehiculo.count(),
      // @ts-ignore
      prisma.vehiculo.count({ where: { activo: true, estado: 'disponible' } }),
      // @ts-ignore
      prisma.vencimientoVehiculo.findMany({
        include: { vehiculo: true },
      }),
      // @ts-ignore
      prisma.vehiculo.findMany({ where: { activo: true } })
    ]);

    const hoy = new Date();
    let proximosVencer = 0;
    let vencidos = 0;
    let ok = 0;

    let alertasArray: any[] = [];

    vencimientos.forEach((v: any) => {
      const fecha = new Date(v.fechaVencimiento);
      const diasAviso = v.diasAviso || 30;
      
      const limiteAviso = new Date(fecha);
      limiteAviso.setDate(fecha.getDate() - diasAviso);

      if (fecha < hoy) {
        vencidos++;
        alertasArray.push({ id: `venc-${v.id}`, tipo: 'vencimiento', gravedad: 'roja', titulo: `${v.tipo} vencido`, fecha: v.fechaVencimiento, vehiculo: v.vehiculo });
      } else if (hoy >= limiteAviso) {
        proximosVencer++;
        alertasArray.push({ id: `venc-${v.id}`, tipo: 'vencimiento', gravedad: 'naranja', titulo: `${v.tipo} próximo (en <${diasAviso}d)`, fecha: v.fechaVencimiento, vehiculo: v.vehiculo });
      } else {
        ok++;
      }
    });

    vehiculos.forEach((v: any) => {
      if (v.kmProximoService) {
        const kmsFaltantes = v.kmProximoService - v.kmActual;
        const aviso = v.avisoKmsAntes || 2000;
        
        if (kmsFaltantes <= 0) {
          alertasArray.push({ id: `km-${v.id}`, tipo: 'km', gravedad: 'roja', titulo: `Demorado de Service (${Math.abs(kmsFaltantes)} km)`, vehiculo: v });
        } else if (kmsFaltantes <= aviso) {
          alertasArray.push({ id: `km-${v.id}`, tipo: 'km', gravedad: 'naranja', titulo: `Service en ${kmsFaltantes} km`, vehiculo: v });
        }
      }
    });

    const alertas = alertasArray.sort((a, b) => {
      if (a.gravedad === 'roja' && b.gravedad !== 'roja') return -1;
      if (b.gravedad === 'roja' && a.gravedad !== 'roja') return 1;
      return 0; // sort by gravity
    }).slice(0, 8); // Top 8 alertas

    return NextResponse.json({
      totalVehiculos,
      vehiculosActivos,
      vencimientosStats: {
        vencidos,
        proximosVencer,
        ok,
        total: vencimientos.length
      },
      alertas
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
