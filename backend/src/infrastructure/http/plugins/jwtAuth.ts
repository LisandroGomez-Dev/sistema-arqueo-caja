import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RolUsuario } from '../../../domain/entities/Usuario.js';
import {
  CredencialesInvalidasError,
  RolNoAutorizadoError,
} from '../../../domain/errors/DominioError.js';

export interface JwtUsuarioPayload {
  id_usuario: string;
  nombre_completo: string;
  rol_usuario: RolUsuario;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUsuarioPayload;
    user: JwtUsuarioPayload;
  }
}

export async function autenticarJWT(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new CredencialesInvalidasError(
      'Tu sesión venció o el token no es válido. Iniciá sesión nuevamente.',
    );
  }
}

export function requerirRol(rolesPermitidos: RolUsuario[]) {
  return async function verificarRol(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const rol = request.user?.rol_usuario;
    if (!rol || !rolesPermitidos.includes(rol)) {
      throw new RolNoAutorizadoError(
        'No tenés permisos suficientes para realizar esta operación (RN-08).',
      );
    }
  };
}
