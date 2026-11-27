/**
 * Formatea un string decimal exacto ("15000.00") a moneda rioplatense ("$ 15.000,00")
 * sin convertirlo a punto flotante binario.
 */
export function formatearPesos(montoDecimal: string | null | undefined): string {
  if (!montoDecimal) return '$ 0,00';
  const limpio = montoDecimal.trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(limpio);
  if (!match) return `$ ${limpio}`;

  const signo = match[1] ? '-' : '';
  const parteEntera = match[2] ?? '0';
  const parteDecimal = (match[3] ?? '00').padEnd(2, '0');
  const enteraConPuntos = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${signo}$ ${enteraConPuntos},${parteDecimal}`;
}

/**
 * Normaliza entrada de usuario ("15.000,50", "15000,5", "15000") a string decimal exacto ("15000.50")
 * o retorna null si el formato es inválido.
 */
export function normalizarEntradaMonetaria(entrada: string): string | null {
  const sinEspacios = entrada.trim().replace(/\s+/g, '');
  if (!sinEspacios) return null;

  let normalizado = sinEspacios;
  if (normalizado.includes(',')) {
    // Formato rioplatense: puntos como miles y coma como decimal
    normalizado = normalizado.replace(/\./g, '').replace(',', '.');
  } else {
    // Si tiene múltiples puntos (ej. "15.000.000"), son separadores de miles
    const partes = normalizado.split('.');
    if (partes.length > 2) {
      normalizado = partes.join('');
    }
  }

  const match = /^(-?\d+)(?:\.(\d{1,2}))?$/.exec(normalizado);
  if (!match) return null;

  const entero = match[1];
  const dec = (match[2] ?? '00').padEnd(2, '0');
  return `${entero}.${dec}`;
}

export function formatearHoraArgentina(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(isoDate));
  } catch {
    return '--:--';
  }
}
