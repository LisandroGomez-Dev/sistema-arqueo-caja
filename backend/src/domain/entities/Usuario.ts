export type RolUsuario = 'CAJERO' | 'ENCARGADO';

export interface UsuarioProps {
  idUsuario: string;
  nombreCompleto: string;
  rolUsuario: RolUsuario;
  estaActivo: boolean;
  fechaAlta: Date;
}

/**
 * Operador habilitado para operar el mostrador o supervisar caja (RN-08).
 */
export class Usuario {
  readonly idUsuario: string;
  readonly nombreCompleto: string;
  readonly rolUsuario: RolUsuario;
  readonly estaActivo: boolean;
  readonly fechaAlta: Date;

  constructor(props: UsuarioProps) {
    this.idUsuario = props.idUsuario;
    this.nombreCompleto = props.nombreCompleto;
    this.rolUsuario = props.rolUsuario;
    this.estaActivo = props.estaActivo;
    this.fechaAlta = props.fechaAlta;
  }

  esEncargado(): boolean {
    return this.rolUsuario === 'ENCARGADO';
  }

  puedeAnular(): boolean {
    return this.esEncargado();
  }

  puedeConfigurarRedondeo(): boolean {
    return this.esEncargado();
  }
}
