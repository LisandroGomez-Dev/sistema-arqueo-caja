import { CredencialesInvalidasError } from '../../domain/errors/DominioError.js';
import type { OperadorPublicoDTO } from '../dto/TurnoActivoDTO.js';
import type { PinHasherPort } from '../ports/out/PinHasherPort.js';
import type { UsuarioRepositoryPort } from '../ports/out/UsuarioRepositoryPort.js';

export class AutenticarUsuarioUseCase {
  constructor(
    private readonly usuarioRepo: UsuarioRepositoryPort,
    private readonly pinHasher: PinHasherPort,
  ) {}

  async ejecutar(idUsuario: string, pin: string): Promise<OperadorPublicoDTO> {
    const registro = await this.usuarioRepo.buscarPorIdConHash(idUsuario);
    if (!registro || !registro.usuario.estaActivo) {
      throw new CredencialesInvalidasError();
    }

    const pinValido = await this.pinHasher.verificar(pin, registro.pinAccesoHash);
    if (!pinValido) {
      throw new CredencialesInvalidasError();
    }

    return {
      id_usuario: registro.usuario.idUsuario,
      nombre_completo: registro.usuario.nombreCompleto,
      rol_usuario: registro.usuario.rolUsuario,
    };
  }
}
