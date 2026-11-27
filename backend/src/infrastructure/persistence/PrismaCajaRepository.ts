import { EstadoTurno as PrismaEstadoTurno, type PrismaClient } from '@prisma/client';
import type { CajaConEstadoDTO } from '../../application/dto/TurnoActivoDTO.js';
import type { CajaRepositoryPort } from '../../application/ports/out/CajaRepositoryPort.js';
import { Caja } from '../../domain/entities/Caja.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';

export class PrismaCajaRepository implements CajaRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorId(idCaja: string): Promise<Caja | null> {
    const row = await this.prisma.caja.findUnique({
      where: { id_caja: idCaja },
    });

    if (!row) return null;

    return new Caja({
      idCaja: row.id_caja,
      numeroCaja: row.numero_caja,
      nombreCaja: row.nombre_caja,
      estaActiva: row.esta_activa,
    });
  }

  async listarActivasConEstado(): Promise<CajaConEstadoDTO[]> {
    const cajas = await this.prisma.caja.findMany({
      where: { esta_activa: true },
      orderBy: { numero_caja: 'asc' },
      include: {
        turnos: {
          where: { estado_turno: PrismaEstadoTurno.ABIERTO },
          take: 1,
          include: {
            usuario_apertura: {
              select: {
                id_usuario: true,
                nombre_completo: true,
                rol_usuario: true,
              },
            },
          },
        },
      },
    });

    return cajas.map((c) => {
      const turnoAbierto = c.turnos[0];
      return {
        id_caja: c.id_caja,
        numero_caja: c.numero_caja,
        nombre_caja: c.nombre_caja,
        estado_caja: turnoAbierto ? 'OCUPADA' : 'LIBRE',
        turno_activo: turnoAbierto
          ? {
              id_turno: turnoAbierto.id_turno,
              fecha_hora_apertura: turnoAbierto.fecha_hora_apertura.toISOString(),
              fondo_inicial_efectivo: Dinero.desde(
                turnoAbierto.fondo_inicial_efectivo.toString(),
              ).aString(),
              usuario_apertura: turnoAbierto.usuario_apertura,
            }
          : null,
      };
    });
  }
}
