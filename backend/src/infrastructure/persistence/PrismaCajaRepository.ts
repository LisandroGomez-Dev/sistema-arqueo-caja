import { EstadoTurno as PrismaEstadoTurno, type PrismaClient } from '@prisma/client';
import type { CajaConEstadoDTO } from '../../application/dto/TurnoActivoDTO.js';
import type { CajaRepositoryPort } from '../../application/ports/out/CajaRepositoryPort.js';
import type { Caja } from '../../domain/entities/Caja.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import type { CatalogoCache } from './CatalogoCache.js';

export class PrismaCajaRepository implements CajaRepositoryPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly catalogo: CatalogoCache,
  ) {}

  async buscarPorId(idCaja: string): Promise<Caja | null> {
    const snap = await this.catalogo.obtener();
    return snap.cajasPorId.get(idCaja) ?? null;
  }

  async listarActivasConEstado(): Promise<CajaConEstadoDTO[]> {
    const [snap, turnosAbiertos] = await Promise.all([
      this.catalogo.obtener(),
      this.prisma.turnoCaja.findMany({
        where: { estado_turno: PrismaEstadoTurno.ABIERTO },
        select: {
          id_turno: true,
          id_caja: true,
          id_usuario_apertura: true,
          fondo_inicial_efectivo: true,
          fecha_hora_apertura: true,
        },
      }),
    ]);

    const turnoPorCaja = new Map(turnosAbiertos.map((t) => [t.id_caja, t]));

    return snap.cajas
      .filter((c) => c.estaActiva)
      .map((c) => {
        const turnoAbierto = turnoPorCaja.get(c.idCaja);
        const usuario = turnoAbierto
          ? snap.usuariosPorId.get(turnoAbierto.id_usuario_apertura)
          : undefined;

        return {
          id_caja: c.idCaja,
          numero_caja: c.numeroCaja,
          nombre_caja: c.nombreCaja,
          estado_caja: turnoAbierto ? 'OCUPADA' : 'LIBRE',
          turno_activo:
            turnoAbierto && usuario
              ? {
                  id_turno: turnoAbierto.id_turno,
                  fecha_hora_apertura:
                    turnoAbierto.fecha_hora_apertura.toISOString(),
                  fondo_inicial_efectivo: Dinero.desde(
                    turnoAbierto.fondo_inicial_efectivo.toString(),
                  ).aString(),
                  usuario_apertura: {
                    id_usuario: usuario.idUsuario,
                    nombre_completo: usuario.nombreCompleto,
                    rol_usuario: usuario.rolUsuario,
                  },
                }
              : null,
        };
      });
  }
}
