export interface ParsedDecimal {
  /** Normalized for DB/JS: decimal separator '.' and no thousand separators */
  normalized: string;
  /** Numeric version (may have floating point precision limits) */
  number: number;
}

export function normalizeDecimalInput(raw: string): string {
  let s = (raw ?? '').trim();
  if (!s) return '';

  // Remove spaces
  s = s.replace(/\s+/g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  // Decide decimal separator and strip thousands.
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // pt-BR like 1.234,56
      s = s.replace(/\./g, '');
      s = s.replace(',', '.');
    } else {
      // en-US like 1,234.56
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Only comma => treat as decimal
    s = s.replace(/\./g, '');
    s = s.replace(',', '.');
  } else {
    // Only dot or none => remove stray commas
    s = s.replace(/,/g, '');
  }

  // Keep sign, digits, and a single dot.
  const sign = s.startsWith('-') ? '-' : '';
  s = s.replace(/^[+-]/, '');
  s = s.replace(/[^0-9.]/g, '');

  const parts = s.split('.');
  if (parts.length > 1) {
    s = parts[0] + '.' + parts.slice(1).join(''); // merge extra dots
  }

  return sign + s;
}

export function parseDecimalInput(
  raw: string,
  opts?: {
    min?: number;
    maxDecimals?: number;
    allowNegative?: boolean;
  }
): ParsedDecimal | null {
  const normalized = normalizeDecimalInput(raw);
  if (!normalized || normalized === '-' || normalized === '.') return null;

  // Trim decimals without rounding (if maxDecimals provided)
  let normalizedLimited = normalized;
  if (typeof opts?.maxDecimals === 'number' && normalized.includes('.')) {
    const [intPart, decPart = ''] = normalized.split('.');
    if (decPart.length > opts.maxDecimals) {
      normalizedLimited = `${intPart}.${decPart.slice(0, opts.maxDecimals)}`;
    }
  }

  const num = Number(normalizedLimited);
  if (!Number.isFinite(num)) return null;

  if (opts?.allowNegative !== true && num < 0) return null;
  if (typeof opts?.min === 'number' && num < opts.min) return null;

  return { normalized: normalizedLimited, number: num };
}
