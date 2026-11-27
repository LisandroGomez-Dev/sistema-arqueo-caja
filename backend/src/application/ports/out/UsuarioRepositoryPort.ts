import type { Usuario } from '../../../domain/entities/Usuario.js';
import type { OperadorPublicoDTO } from '../../dto/TurnoActivoDTO.js';

export interface UsuarioConHash {
  usuario: Usuario;
  pinAccesoHash: string;
}

export interface UsuarioRepositoryPort {
  listarActivos(): Promise<OperadorPublicoDTO[]>;
  buscarPorId(idUsuario: string): Promise<Usuario | null>;
  buscarPorIdConHash(idUsuario: string): Promise<UsuarioConHash | null>;
}
