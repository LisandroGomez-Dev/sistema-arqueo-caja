import { Decimal } from 'decimal.js';
import { MontoInvalidoError } from '../errors/DominioError.js';

const DecimalExacto = Decimal.clone({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

const PATRON_DECIMAL = /^-?\d+(?:\.\d+)?$/;

/**
 * Value Object monetario inmutable basado en decimal.js (RNF-01, RN-06).
 * Evita cualquier representación en punto flotante binario.
 */
export class Dinero {
  private readonly valor: Decimal;

  private constructor(valor: Decimal) {
    this.valor = valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  static desde(entrada: string | Decimal | Dinero): Dinero {
    if (entrada instanceof Dinero) {
      return entrada;
    }

    if (typeof entrada === 'string') {
      const limpio = entrada.trim();
      if (!PATRON_DECIMAL.test(limpio)) {
        throw new MontoInvalidoError(
          `El importe "${entrada}" no tiene un formato decimal válido.`,
        );
      }
      const parsed = new DecimalExacto(limpio);
      if (!parsed.isFinite()) {
        throw new MontoInvalidoError('El importe debe ser un número finito.');
      }
      return new Dinero(parsed);
    }

    if (!entrada.isFinite()) {
      throw new MontoInvalidoError('El importe debe ser un número finito.');
    }

    return new Dinero(new DecimalExacto(entrada));
  }

  static cero(): Dinero {
    return new Dinero(new DecimalExacto(0));
  }

  esNegativo(): boolean {
    return this.valor.isNegative();
  }

  esCero(): boolean {
    return this.valor.isZero();
  }

  esPositivo(): boolean {
    return this.valor.isPositive() && !this.valor.isZero();
  }

  sumar(otro: Dinero): Dinero {
    return new Dinero(this.valor.plus(otro.valor));
  }

  restar(otro: Dinero): Dinero {
    return new Dinero(this.valor.minus(otro.valor));
  }

  igualA(otro: Dinero): boolean {
    return this.valor.equals(otro.valor);
  }

  aString(): string {
    return this.valor.toFixed(2);
  }

  aDecimal(): Decimal {
    return new DecimalExacto(this.valor);
  }
}
