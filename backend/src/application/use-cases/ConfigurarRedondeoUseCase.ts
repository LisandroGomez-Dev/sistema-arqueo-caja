import {
  ConfiguracionNoEncontradaError,
  RolNoAutorizadoError,
} from '../../domain/errors/DominioError.js';
import { Dinero } from '../../domain/value-objects/Dinero.js';
import {
  mapearConfiguracionCajaDTO,
  type ConfiguracionCajaDTO,
} from '../dto/ConfiguracionDTO.js';
import type { ConfiguracionRepositoryPort } from '../ports/out/ConfiguracionRepositoryPort.js';
import type { UsuarioRepositoryPort } from '../ports/out/UsuarioRepositoryPort.js';

export interface ConfigurarRedondeoInput {
  idUsuarioEncargado: string;
  multiploRedondeoEfectivo: string;
}

/**
 * Caso de uso CU-ConfigurarRedondeo (Issue #5 · RF-09, RN-04, RN-08).
 * Actualiza el margen de tolerancia/redondeo en efectivo aplicable solo a cierres futuros.
 */
export class ConfigurarRedondeoUseCase {
  constructor(
    private readonly configRepo: ConfiguracionRepositoryPort,
    private readonly usuarioRepo: UsuarioRepositoryPort,
  ) {}

  async ejecutar(
    input: ConfigurarRedondeoInput,
  ): Promise<ConfiguracionCajaDTO> {
    const nuevoMultiplo = Dinero.desde(input.multiploRedondeoEfectivo);

    const [usuario, configuracion] = await Promise.all([
      this.usuarioRepo.buscarPorId(input.idUsuarioEncargado),
      this.configRepo.obtenerActual(),
    ]);

    if (!usuario || !usuario.estaActivo || !usuario.puedeConfigurarRedondeo()) {
      throw new RolNoAutorizadoError(
        'Solo un usuario con rol ENCARGADO puede configurar el redondeo comercial (RN-08).',
      );
    }

    if (!configuracion) {
      throw new ConfiguracionNoEncontradaError();
    }

    configuracion.actualizarMultiplo(nuevoMultiplo, usuario);

    const actualizada = await this.configRepo.guardarActualizacion(configuracion);
    return mapearConfiguracionCajaDTO(actualizada, usuario);
  }
}
