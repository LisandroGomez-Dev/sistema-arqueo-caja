import type { PrismaClient } from '@prisma/client';
import type {
  CajaResumenDTO,
  ConfiguracionPublicaDTO,
  OperadorPublicoDTO,
} from '../../application/dto/TurnoActivoDTO.js';
import { Caja } from '../../domain/entities/Caja.js';
import { MetodoPago } from '../../domain/entities/MetodoPago.js';
import { Usuario } from '../../domain/entities/Usuario.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';

const TTL_MS = 60_000;

export interface CatalogoSnapshot {
  usuarios: Usuario[];
  usuariosPublicos: OperadorPublicoDTO[];
  usuariosPorId: Map<string, Usuario>;
  cajas: Caja[];
  cajasPorId: Map<string, Caja>;
  cajasResumenPorId: Map<string, CajaResumenDTO>;
  metodosPago: MetodoPago[];
  metodosPorId: Map<string, MetodoPago>;
  metodosPorCodigo: Map<string, MetodoPago>;
  configuracion: {
    idConfiguracion: string;
    nombreComercio: string;
    multiploRedondeoEfectivo: Dinero;
    idUsuarioActualizacion: string;
    fechaUltimaActualizacion: Date;
    publica: ConfiguracionPublicaDTO;
  } | null;
}

/**
 * Caché TTL de 60s para catálogos casi estáticos (usuarios, cajas, métodos de pago y configuración).
 * Evita consultas repetidas a PostgreSQL en cada operación del mostrador (RNF-04 < 500 ms).
 */
export class CatalogoCache {
  private snapshot: { expiraEn: number; data: CatalogoSnapshot } | null = null;
  private cargaEnVuelo: Promise<CatalogoSnapshot> | null = null;

  constructor(private readonly prisma: PrismaClient) {}

  invalidar(): void {
    this.snapshot = null;
  }

  async obtener(): Promise<CatalogoSnapshot> {
    const ahora = Date.now();
    if (this.snapshot && ahora < this.snapshot.expiraEn) {
      return this.snapshot.data;
    }

    if (this.cargaEnVuelo) {
      return this.cargaEnVuelo;
    }

    this.cargaEnVuelo = (async () => {
      const [usuariosRows, cajasRows, metodosRows, configRow] = await Promise.all([
        this.prisma.usuario.findMany({
          orderBy: [{ rol_usuario: 'asc' }, { nombre_completo: 'asc' }],
          select: {
            id_usuario: true,
            nombre_completo: true,
            rol_usuario: true,
            esta_activo: true,
            fecha_alta: true,
          },
        }),
        this.prisma.caja.findMany({
          orderBy: { numero_caja: 'asc' },
        }),
        this.prisma.metodoPago.findMany({
          where: { esta_activo: true },
          orderBy: { codigo_metodo: 'asc' },
        }),
        this.prisma.configuracionCaja.findFirst({
          orderBy: { fecha_ultima_actualizacion: 'desc' },
        }),
      ]);

      const usuarios = usuariosRows.map(
        (u) =>
          new Usuario({
            idUsuario: u.id_usuario,
            nombreCompleto: u.nombre_completo,
            rolUsuario: u.rol_usuario,
            estaActivo: u.esta_activo,
            fechaAlta: u.fecha_alta,
          }),
      );

      const usuariosPorId = new Map(usuarios.map((u) => [u.idUsuario, u]));
      const usuariosPublicos: OperadorPublicoDTO[] = usuarios
        .filter((u) => u.estaActivo)
        .map((u) => ({
          id_usuario: u.idUsuario,
          nombre_completo: u.nombreCompleto,
          rol_usuario: u.rolUsuario,
        }));

      const cajas = cajasRows.map(
        (c) =>
          new Caja({
            idCaja: c.id_caja,
            numeroCaja: c.numero_caja,
            nombreCaja: c.nombre_caja,
            estaActiva: c.esta_activa,
          }),
      );

      const cajasPorId = new Map(cajas.map((c) => [c.idCaja, c]));
      const cajasResumenPorId = new Map<string, CajaResumenDTO>(
        cajas.map((c) => [
          c.idCaja,
          {
            id_caja: c.idCaja,
            numero_caja: c.numeroCaja,
            nombre_caja: c.nombreCaja,
          },
        ]),
      );

      const metodosPago = metodosRows.map(
        (m) =>
          new MetodoPago({
            idMetodoPago: m.id_metodo_pago,
            codigoMetodo: m.codigo_metodo,
            nombreMetodo: m.nombre_metodo,
            permiteRedondeo: m.permite_redondeo,
            estaActivo: m.esta_activo,
          }),
      );

      const metodosPorId = new Map(metodosPago.map((m) => [m.idMetodoPago, m]));
      const metodosPorCodigo = new Map(
        metodosPago.map((m) => [m.codigoMetodo.toUpperCase(), m]),
      );

      const configuracion = configRow
        ? (() => {
            const multiplo = Dinero.desde(
              configRow.multiplo_redondeo_efectivo.toString(),
            );
            return {
              idConfiguracion: configRow.id_configuracion,
              nombreComercio: configRow.nombre_comercio,
              multiploRedondeoEfectivo: multiplo,
              idUsuarioActualizacion: configRow.id_usuario_actualizacion,
              fechaUltimaActualizacion: configRow.fecha_ultima_actualizacion,
              publica: {
                nombre_comercio: configRow.nombre_comercio,
                multiplo_redondeo_efectivo: multiplo.aString(),
              },
            };
          })()
        : null;

      const data: CatalogoSnapshot = {
        usuarios,
        usuariosPublicos,
        usuariosPorId,
        cajas,
        cajasPorId,
        cajasResumenPorId,
        metodosPago,
        metodosPorId,
        metodosPorCodigo,
        configuracion,
      };

      this.snapshot = { expiraEn: Date.now() + TTL_MS, data };
      return data;
    })().finally(() => {
      this.cargaEnVuelo = null;
    });

    return this.cargaEnVuelo;
  }
}
