import { randomUUID } from 'node:crypto';
import type { LineaCalculoArqueoInput } from '../../domain/entities/ArqueoCierre.js';
import type { RolUsuario } from '../../domain/entities/Usuario.js';
import {
  MontoInvalidoError,
  RolNoAutorizadoError,
  TurnoNoEncontradoError,
  UsuarioNoEncontradoError,
} from '../../domain/errors/DominioError.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import type { ArqueoCierreDTO } from '../dto/ArqueoDTO.js';
import type { ArqueoRepositoryPort } from '../ports/out/ArqueoRepositoryPort.js';
import type { ConfiguracionRepositoryPort } from '../ports/out/ConfiguracionRepositoryPort.js';
import type { MetodoPagoRepositoryPort } from '../ports/out/MetodoPagoRepositoryPort.js';
import type { TurnoRepositoryPort } from '../ports/out/TurnoRepositoryPort.js';
import type { UsuarioRepositoryPort } from '../ports/out/UsuarioRepositoryPort.js';

export interface CerrarTurnoInput {
  idTurno: string;
  idUsuarioCierre: string;
  rolUsuario: RolUsuario;
  efectivoDeclarado: string;
  observacionesCierre?: string | null;
}

/**
 * Caso de uso CU-CerrarCaja (Issue #6 · RN-03, RN-04, RN-05, RN-06, RN-07, RN-08).
 * Ejecuta el motor determinístico de redondeo/arqueo, transiciona el turno a CERRADO
 * y persiste turno + arqueos_cierre + detalle_arqueo_metodo en una única transacción atómica.
 */
export class CerrarTurnoUseCase {
  constructor(
    private readonly turnoRepo: TurnoRepositoryPort,
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly configRepo: ConfiguracionRepositoryPort,
    private readonly metodoPagoRepo: MetodoPagoRepositoryPort,
    private readonly arqueoRepo: ArqueoRepositoryPort,
  ) {}

  async ejecutar(input: CerrarTurnoInput): Promise<ArqueoCierreDTO> {
    const efectivoDeclarado = Dinero.desde(input.efectivoDeclarado);
    if (efectivoDeclarado.esNegativo()) {
      throw new MontoInvalidoError(
        'El efectivo físico contado debe ser mayor o igual a $0,00 (RN-06).',
      );
    }

    const [turno, usuarioCierre, config, metodosActivos] = await Promise.all([
      this.turnoRepo.buscarPorId(input.idTurno),
      this.usuarioRepo.buscarPorId(input.idUsuarioCierre),
      this.configRepo.obtenerActual(),
      this.metodoPagoRepo.listarActivos(),
    ]);

    if (!usuarioCierre || !usuarioCierre.estaActivo) {
      throw new UsuarioNoEncontradoError();
    }

    if (!turno) {
      throw new TurnoNoEncontradoError();
    }

    // Patrón State (RN-05): rechaza cierre si ya está CERRADO.
    turno.validarOperacion();

    // Multi-Caja + RN-08: un CAJERO solo puede cerrar su propia caja activa.
    if (
      input.rolUsuario !== 'ENCARGADO' &&
      turno.idUsuarioApertura !== input.idUsuarioCierre
    ) {
      throw new RolNoAutorizadoError(
        'Solo podés cerrar tu propia caja activa (RN-08).',
      );
    }

    // Resumen pre-cargado por buscarPorId en Prisma (0 consultas extra).
    const resumen = await this.turnoRepo.obtenerResumenTurnoActivo(turno);
    const esperadoPorMetodo = new Map(
      resumen.subtotales_por_metodo.map((s) => [
        s.id_metodo_pago,
        Dinero.desde(s.monto_esperado),
      ]),
    );

    const multiploAplicado = config
      ? config.getMultiploRedondeoEfectivo()
      : Dinero.cero();

    // Ordenar EFECTIVO primero y luego por código para mantener consistencia visual.
    const metodosOrdenados = [...metodosActivos].sort((a, b) => {
      if (a.esEfectivo() && !b.esEfectivo()) return -1;
      if (!a.esEfectivo() && b.esEfectivo()) return 1;
      return a.codigoMetodo.localeCompare(b.codigoMetodo);
    });

    const lineas: LineaCalculoArqueoInput[] = metodosOrdenados.map((metodo) => {
      const montoEsperado =
        esperadoPorMetodo.get(metodo.idMetodoPago) ?? Dinero.cero();
      const montoDeclarado = metodo.esEfectivo()
        ? efectivoDeclarado
        : montoEsperado.esNegativo()
          ? Dinero.cero()
          : montoEsperado;

      return {
        idDetalleArqueo: randomUUID(),
        metodoPago: metodo,
        montoEsperado,
        montoDeclarado,
      };
    });

    const observacionesLimpias = input.observacionesCierre?.trim() || null;

    const arqueo = turno.cerrar({
      idArqueo: randomUUID(),
      usuarioCierre,
      multiploRedondeoAplicado: multiploAplicado,
      observacionesCierre: observacionesLimpias,
      lineas,
      fechaCierre: new Date(),
    });

    return this.arqueoRepo.guardarCierreAtomico(turno, arqueo);
  }
}
