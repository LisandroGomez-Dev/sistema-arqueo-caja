import type { PrismaClient } from '@prisma/client';
import type { OperadorPublicoDTO } from '../../application/dto/TurnoActivoDTO.js';
import type {
  UsuarioConHash,
  UsuarioRepositoryPort,
} from '../../application/ports/out/UsuarioRepositoryPort.js';
import { Usuario } from '../../domain/entities/Usuario.js';
import type { CatalogoCache } from './CatalogoCache.js';

export class PrismaUsuarioRepository implements UsuarioRepositoryPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly catalogo: CatalogoCache,
  ) {}

  async listarActivos(): Promise<OperadorPublicoDTO[]> {
    const snap = await this.catalogo.obtener();
    return snap.usuariosPublicos;
  }

  async buscarPorId(idUsuario: string): Promise<Usuario | null> {
    const snap = await this.catalogo.obtener();
    return snap.usuariosPorId.get(idUsuario) ?? null;
  }

  async buscarPorIdConHash(idUsuario: string): Promise<UsuarioConHash | null> {
    const row = await this.prisma.usuario.findUnique({
      where: { id_usuario: idUsuario },
    });

    if (!row) {
      return null;
    }

    return {
      usuario: new Usuario({
        idUsuario: row.id_usuario,
        nombreCompleto: row.nombre_completo,
        rolUsuario: row.rol_usuario,
        estaActivo: row.esta_activo,
        fechaAlta: row.fecha_alta,
      }),
      pinAccesoHash: row.pin_acceso_hash,
    };
  }
}
