// Custom formula engine with A1 notation support
// Inspired by Google Sheets / Excel
// Supports: math, logical, text, lookup, date, statistical functions

export type CellValue = string | number | boolean | null;
export type CellData = Map<string, { value: CellValue; formula?: string }>;

// ─── Cell reference helpers ─────────────────────────────────────
export function colIndexToLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function letterToColIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

export function parseCellRef(ref: string): { col: number; row: number; absCol?: boolean; absRow?: boolean } | null {
  const match = ref.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/i);
  if (!match) return null;
  return {
    absCol: match[1] === '$',
    col: letterToColIndex(match[2].toUpperCase()),
    absRow: match[3] === '$',
    row: parseInt(match[4], 10) - 1,
  };
}

export function cellKey(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`;
}

function parseRange(range: string): string[] {
  const parts = range.split(':');
  if (parts.length !== 2) return [range];
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return [range];
  const cells: string[] = [];
  const r1 = Math.min(start.row, end.row);
  const r2 = Math.max(start.row, end.row);
  const c1 = Math.min(start.col, end.col);
  const c2 = Math.max(start.col, end.col);
  for (let row = r1; row <= r2; row++) {
    for (let col = c1; col <= c2; col++) cells.push(cellKey(row, col));
  }
  return cells;
}

// ─── Value coercion ─────────────────────────────────────────────
function getNumericValue(value: CellValue): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const s = value.replace(',', '.').trim();
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function getStringValue(value: CellValue): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function isNumeric(v: CellValue): boolean {
  if (typeof v === 'number') return !isNaN(v);
  if (typeof v === 'string' && v.trim() !== '') return !isNaN(parseFloat(v.replace(',', '.')));
  return false;
}

// ─── Built-in functions ─────────────────────────────────────────
type FuncImpl = (args: CellValue[], rawArgs?: string[], cells?: CellData, visited?: Set<string>) => CellValue;

const functions: Record<string, FuncImpl> = {
  // ── Math
  SUM: (a) => a.reduce((s: number, v) => s + getNumericValue(v), 0),
  AVERAGE: (a) => {
    const nums = a.filter((v) => v !== null && v !== '' && isNumeric(v)).map(getNumericValue);
    return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : '#DIV/0!';
  },
  MIN: (a) => {
    const nums = a.filter(isNumeric).map(getNumericValue);
    return nums.length ? Math.min(...nums) : 0;
  },
  MAX: (a) => {
    const nums = a.filter(isNumeric).map(getNumericValue);
    return nums.length ? Math.max(...nums) : 0;
  },
  MEDIAN: (a) => {
    const nums = a.filter(isNumeric).map(getNumericValue).sort((x, y) => x - y);
    if (!nums.length) return 0;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  },
  PRODUCT: (a) => a.reduce((p: number, v) => p * (isNumeric(v) ? getNumericValue(v) : 1), 1),
  COUNT: (a) => a.filter(isNumeric).length,
  COUNTA: (a) => a.filter((v) => v !== null && v !== undefined && v !== '').length,
  COUNTBLANK: (a) => a.filter((v) => v === null || v === undefined || v === '').length,
  ROUND: (a) => {
    const n = getNumericValue(a[0]);
    const d = a[1] !== undefined ? getNumericValue(a[1]) : 0;
    const m = Math.pow(10, d);
    return Math.round(n * m) / m;
  },
  ROUNDUP: (a) => {
    const n = getNumericValue(a[0]);
    const d = a[1] !== undefined ? getNumericValue(a[1]) : 0;
    const m = Math.pow(10, d);
    return n >= 0 ? Math.ceil(n * m) / m : Math.floor(n * m) / m;
  },
  ROUNDDOWN: (a) => {
    const n = getNumericValue(a[0]);
    const d = a[1] !== undefined ? getNumericValue(a[1]) : 0;
    const m = Math.pow(10, d);
    return n >= 0 ? Math.floor(n * m) / m : Math.ceil(n * m) / m;
  },
  ABS: (a) => Math.abs(getNumericValue(a[0])),
  SQRT: (a) => {
    const n = getNumericValue(a[0]);
    return n < 0 ? '#NUM!' : Math.sqrt(n);
  },
  POWER: (a) => Math.pow(getNumericValue(a[0]), getNumericValue(a[1])),
  EXP: (a) => Math.exp(getNumericValue(a[0])),
  LN: (a) => {
    const n = getNumericValue(a[0]);
    return n <= 0 ? '#NUM!' : Math.log(n);
  },
  LOG: (a) => {
    const n = getNumericValue(a[0]);
    const b = a[1] !== undefined ? getNumericValue(a[1]) : 10;
    return n <= 0 ? '#NUM!' : Math.log(n) / Math.log(b);
  },
  LOG10: (a) => {
    const n = getNumericValue(a[0]);
    return n <= 0 ? '#NUM!' : Math.log10(n);
  },
  MOD: (a) => {
    const d = getNumericValue(a[1]);
    if (d === 0) return '#DIV/0!';
    return getNumericValue(a[0]) % d;
  },
  INT: (a) => Math.floor(getNumericValue(a[0])),
  TRUNC: (a) => Math.trunc(getNumericValue(a[0])),
  FLOOR: (a) => {
    const n = getNumericValue(a[0]);
    const s = a[1] !== undefined ? getNumericValue(a[1]) : 1;
    return s === 0 ? '#DIV/0!' : Math.floor(n / s) * s;
  },
  CEILING: (a) => {
    const n = getNumericValue(a[0]);
    const s = a[1] !== undefined ? getNumericValue(a[1]) : 1;
    return s === 0 ? '#DIV/0!' : Math.ceil(n / s) * s;
  },
  SIGN: (a) => Math.sign(getNumericValue(a[0])),
  PI: () => Math.PI,
  RAND: () => Math.random(),
  RANDBETWEEN: (a) => {
    const lo = Math.ceil(getNumericValue(a[0]));
    const hi = Math.floor(getNumericValue(a[1]));
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  },
  SUMSQ: (a) => a.reduce((s: number, v) => s + Math.pow(getNumericValue(v), 2), 0),

  // ── Statistical
  STDEV: (a) => {
    const nums = a.filter(isNumeric).map(getNumericValue);
    if (nums.length < 2) return '#DIV/0!';
    const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
    const variance = nums.reduce((s, n) => s + (n - mean) ** 2, 0) / (nums.length - 1);
    return Math.sqrt(variance);
  },
  VAR: (a) => {
    const nums = a.filter(isNumeric).map(getNumericValue);
    if (nums.length < 2) return '#DIV/0!';
    const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
    return nums.reduce((s, n) => s + (n - mean) ** 2, 0) / (nums.length - 1);
  },

  // ── Logical
  IF: (a) => {
    const cond = a[0];
    const truthy = typeof cond === 'boolean' ? cond : !!cond && cond !== 0 && cond !== '';
    return truthy ? (a[1] ?? true) : (a[2] ?? false);
  },
  IFS: (a) => {
    for (let i = 0; i < a.length - 1; i += 2) {
      const c = a[i];
      const truthy = typeof c === 'boolean' ? c : !!c && c !== 0 && c !== '';
      if (truthy) return a[i + 1];
    }
    return '#N/A';
  },
  AND: (a) => a.every((v) => (typeof v === 'boolean' ? v : !!v && v !== 0 && v !== '')),
  OR: (a) => a.some((v) => (typeof v === 'boolean' ? v : !!v && v !== 0 && v !== '')),
  NOT: (a) => !(typeof a[0] === 'boolean' ? a[0] : !!a[0] && a[0] !== 0 && a[0] !== ''),
  XOR: (a) => a.filter((v) => (typeof v === 'boolean' ? v : !!v && v !== 0 && v !== '')).length % 2 === 1,
  TRUE: () => true,
  FALSE: () => false,
  IFERROR: (a) => {
    const v = a[0];
    if (typeof v === 'string' && v.startsWith('#')) return a[1] ?? '';
    return v;
  },
  IFNA: (a) => (a[0] === '#N/A' ? (a[1] ?? '') : a[0]),
  ISBLANK: (a) => a[0] === null || a[0] === undefined || a[0] === '',
  ISNUMBER: (a) => typeof a[0] === 'number' || (typeof a[0] === 'string' && isNumeric(a[0])),
  ISTEXT: (a) => typeof a[0] === 'string' && !isNumeric(a[0]),
  ISERROR: (a) => typeof a[0] === 'string' && a[0].startsWith('#'),

  // ── Text
  CONCATENATE: (a) => a.map(getStringValue).join(''),
  CONCAT: (a) => a.map(getStringValue).join(''),
  TEXTJOIN: (a) => {
    const sep = getStringValue(a[0]);
    const ignoreEmpty = !!a[1];
    const rest = a.slice(2);
    return rest
      .filter((v) => !ignoreEmpty || (v !== null && v !== undefined && v !== ''))
      .map(getStringValue)
      .join(sep);
  },
  LEFT: (a) => getStringValue(a[0]).slice(0, a[1] !== undefined ? getNumericValue(a[1]) : 1),
  RIGHT: (a) => {
    const s = getStringValue(a[0]);
    const n = a[1] !== undefined ? getNumericValue(a[1]) : 1;
    return s.slice(Math.max(0, s.length - n));
  },
  MID: (a) => {
    const s = getStringValue(a[0]);
    const start = Math.max(0, getNumericValue(a[1]) - 1);
    const len = getNumericValue(a[2]);
    return s.slice(start, start + len);
  },
  LEN: (a) => getStringValue(a[0]).length,
  UPPER: (a) => getStringValue(a[0]).toUpperCase(),
  LOWER: (a) => getStringValue(a[0]).toLowerCase(),
  PROPER: (a) =>
    getStringValue(a[0]).replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()),
  TRIM: (a) => getStringValue(a[0]).trim().replace(/\s+/g, ' '),
  SUBSTITUTE: (a) => {
    const text = getStringValue(a[0]);
    const oldT = getStringValue(a[1]);
    const newT = getStringValue(a[2]);
    if (a[3] !== undefined) {
      const occ = getNumericValue(a[3]);
      let count = 0;
      let idx = 0;
      let result = text;
      while (true) {
        const pos = result.indexOf(oldT, idx);
        if (pos < 0) break;
        count++;
        if (count === occ) {
          result = result.slice(0, pos) + newT + result.slice(pos + oldT.length);
          break;
        }
        idx = pos + oldT.length;
      }
      return result;
    }
    return text.split(oldT).join(newT);
  },
  REPLACE: (a) => {
    const s = getStringValue(a[0]);
    const start = Math.max(0, getNumericValue(a[1]) - 1);
    const len = getNumericValue(a[2]);
    const repl = getStringValue(a[3]);
    return s.slice(0, start) + repl + s.slice(start + len);
  },
  FIND: (a) => {
    const find = getStringValue(a[0]);
    const within = getStringValue(a[1]);
    const start = a[2] !== undefined ? getNumericValue(a[2]) - 1 : 0;
    const idx = within.indexOf(find, start);
    return idx < 0 ? '#VALUE!' : idx + 1;
  },
  SEARCH: (a) => {
    const find = getStringValue(a[0]).toLowerCase();
    const within = getStringValue(a[1]).toLowerCase();
    const start = a[2] !== undefined ? getNumericValue(a[2]) - 1 : 0;
    const idx = within.indexOf(find, start);
    return idx < 0 ? '#VALUE!' : idx + 1;
  },
  REPT: (a) => getStringValue(a[0]).repeat(Math.max(0, Math.floor(getNumericValue(a[1])))),
  TEXT: (a) => {
    const n = getNumericValue(a[0]);
    const fmt = getStringValue(a[1]);
    if (/^0+(\.0+)?%$/.test(fmt)) {
      const dec = (fmt.split('.')[1] || '').replace('%', '').length;
      return (n * 100).toFixed(dec) + '%';
    }
    if (/R\$/.test(fmt)) return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (/\$/.test(fmt)) return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    if (/^0+(\.0+)?$/.test(fmt)) {
      const dec = (fmt.split('.')[1] || '').length;
      return n.toFixed(dec);
    }
    return String(n);
  },
  VALUE: (a) => getNumericValue(a[0]),
  EXACT: (a) => getStringValue(a[0]) === getStringValue(a[1]),

  // ── Date
  TODAY: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  NOW: () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
  DATE: (a) => {
    const y = getNumericValue(a[0]);
    const m = getNumericValue(a[1]);
    const d = getNumericValue(a[2]);
    const date = new Date(y, m - 1, d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },
  YEAR: (a) => {
    const d = new Date(getStringValue(a[0]));
    return isNaN(d.getTime()) ? '#VALUE!' : d.getFullYear();
  },
  MONTH: (a) => {
    const d = new Date(getStringValue(a[0]));
    return isNaN(d.getTime()) ? '#VALUE!' : d.getMonth() + 1;
  },
  DAY: (a) => {
    const d = new Date(getStringValue(a[0]));
    return isNaN(d.getTime()) ? '#VALUE!' : d.getDate();
  },
  WEEKDAY: (a) => {
    const d = new Date(getStringValue(a[0]));
    if (isNaN(d.getTime())) return '#VALUE!';
    return d.getDay() + 1; // 1 = Sunday
  },
  DAYS: (a) => {
    const end = new Date(getStringValue(a[0]));
    const start = new Date(getStringValue(a[1]));
    if (isNaN(end.getTime()) || isNaN(start.getTime())) return '#VALUE!';
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  },
  HOUR: (a) => {
    const d = new Date(getStringValue(a[0]));
    return isNaN(d.getTime()) ? '#VALUE!' : d.getHours();
  },
  MINUTE: (a) => {
    const d = new Date(getStringValue(a[0]));
    return isNaN(d.getTime()) ? '#VALUE!' : d.getMinutes();
  },
};

// Conditional / lookup functions need raw range arguments — handled separately
const RANGE_AWARE = new Set([
  'SUMIF', 'COUNTIF', 'AVERAGEIF', 'SUMIFS', 'COUNTIFS', 'AVERAGEIFS',
  'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'XLOOKUP',
]);

function evalCondition(value: CellValue, criterion: CellValue): boolean {
  const c = getStringValue(criterion).trim();
  // Operator-prefixed criteria: ">10", "<=5", "<>foo"
  const opMatch = c.match(/^(<>|>=|<=|>|<|=)(.*)$/);
  if (opMatch) {
    const op = opMatch[1];
    const rhs = opMatch[2].trim();
    const isNum = isNumeric(rhs) && isNumeric(value);
    const lhs = isNum ? getNumericValue(value) : getStringValue(value);
    const r = isNum ? getNumericValue(rhs) : rhs;
    switch (op) {
      case '=': return lhs === r;
      case '<>': return lhs !== r;
      case '>': return lhs > r;
      case '<': return lhs < r;
      case '>=': return lhs >= r;
      case '<=': return lhs <= r;
    }
  }
  // Wildcards * ?
  if (c.includes('*') || c.includes('?')) {
    const re = new RegExp('^' + c.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return re.test(getStringValue(value));
  }
  // Plain equality
  if (isNumeric(c) && isNumeric(value)) return getNumericValue(value) === getNumericValue(c);
  return getStringValue(value).toLowerCase() === c.toLowerCase();
}

function getRangeValues(rangeStr: string, cells: CellData): CellValue[] {
  return parseRange(rangeStr).map((k) => cells.get(k.toUpperCase())?.value ?? null);
}

function getRangeComputed(rangeStr: string, cells: CellData, visited: Set<string>): CellValue[] {
  return parseRange(rangeStr).map((k) => {
    const key = k.toUpperCase();
    const cell = cells.get(key);
    if (cell?.formula) return evaluateFormula(cell.formula, cells, new Set([...visited, key]));
    return cell?.value ?? null;
  });
}

function evaluateRangeFunction(
  funcName: string,
  rawArgs: string[],
  evaluatedArgs: CellValue[],
  cells: CellData,
  visited: Set<string>
): CellValue {
  switch (funcName) {
    case 'SUMIF': {
      const range = getRangeComputed(rawArgs[0], cells, visited);
      const criterion = evaluatedArgs[1];
      const sumRange = rawArgs[2] ? getRangeComputed(rawArgs[2], cells, visited) : range;
      let sum = 0;
      range.forEach((v, i) => { if (evalCondition(v, criterion)) sum += getNumericValue(sumRange[i] ?? 0); });
      return sum;
    }
    case 'COUNTIF': {
      const range = getRangeComputed(rawArgs[0], cells, visited);
      const criterion = evaluatedArgs[1];
      return range.filter((v) => evalCondition(v, criterion)).length;
    }
    case 'AVERAGEIF': {
      const range = getRangeComputed(rawArgs[0], cells, visited);
      const criterion = evaluatedArgs[1];
      const avgRange = rawArgs[2] ? getRangeComputed(rawArgs[2], cells, visited) : range;
      let sum = 0, count = 0;
      range.forEach((v, i) => {
        if (evalCondition(v, criterion)) { sum += getNumericValue(avgRange[i] ?? 0); count++; }
      });
      return count ? sum / count : '#DIV/0!';
    }
    case 'SUMIFS': {
      const sumRange = getRangeComputed(rawArgs[0], cells, visited);
      let sum = 0;
      for (let i = 0; i < sumRange.length; i++) {
        let match = true;
        for (let j = 1; j < rawArgs.length; j += 2) {
          const r = getRangeComputed(rawArgs[j], cells, visited);
          if (!evalCondition(r[i], evaluatedArgs[j + 1])) { match = false; break; }
        }
        if (match) sum += getNumericValue(sumRange[i]);
      }
      return sum;
    }
    case 'COUNTIFS': {
      const first = getRangeComputed(rawArgs[0], cells, visited);
      let count = 0;
      for (let i = 0; i < first.length; i++) {
        let match = true;
        for (let j = 0; j < rawArgs.length; j += 2) {
          const r = j === 0 ? first : getRangeComputed(rawArgs[j], cells, visited);
          if (!evalCondition(r[i], evaluatedArgs[j + 1])) { match = false; break; }
        }
        if (match) count++;
      }
      return count;
    }
    case 'VLOOKUP': {
      const lookup = evaluatedArgs[0];
      const refs = parseRange(rawArgs[1]);
      const colOffset = getNumericValue(evaluatedArgs[2]) - 1;
      const start = parseCellRef(rawArgs[1].split(':')[0]);
      const end = parseCellRef(rawArgs[1].split(':')[1] || rawArgs[1].split(':')[0]);
      if (!start || !end) return '#REF!';
      const width = Math.abs(end.col - start.col) + 1;
      const rows = refs.length / width;
      for (let r = 0; r < rows; r++) {
        const keyCell = cells.get(refs[r * width].toUpperCase());
        const keyVal = keyCell?.formula ? evaluateFormula(keyCell.formula, cells, visited) : keyCell?.value ?? null;
        if (evalCondition(keyVal, lookup)) {
          const target = cells.get(refs[r * width + colOffset].toUpperCase());
          return target?.formula ? evaluateFormula(target.formula, cells, visited) : target?.value ?? '';
        }
      }
      return '#N/A';
    }
    case 'HLOOKUP': {
      const lookup = evaluatedArgs[0];
      const refs = parseRange(rawArgs[1]);
      const rowOffset = getNumericValue(evaluatedArgs[2]) - 1;
      const start = parseCellRef(rawArgs[1].split(':')[0]);
      const end = parseCellRef(rawArgs[1].split(':')[1] || rawArgs[1].split(':')[0]);
      if (!start || !end) return '#REF!';
      const width = Math.abs(end.col - start.col) + 1;
      for (let c = 0; c < width; c++) {
        const keyCell = cells.get(refs[c].toUpperCase());
        const keyVal = keyCell?.formula ? evaluateFormula(keyCell.formula, cells, visited) : keyCell?.value ?? null;
        if (evalCondition(keyVal, lookup)) {
          const target = cells.get(refs[rowOffset * width + c].toUpperCase());
          return target?.formula ? evaluateFormula(target.formula, cells, visited) : target?.value ?? '';
        }
      }
      return '#N/A';
    }
    case 'MATCH': {
      const lookup = evaluatedArgs[0];
      const range = getRangeComputed(rawArgs[1], cells, visited);
      for (let i = 0; i < range.length; i++) {
        if (evalCondition(range[i], lookup)) return i + 1;
      }
      return '#N/A';
    }
    case 'INDEX': {
      const refs = parseRange(rawArgs[0]);
      const start = parseCellRef(rawArgs[0].split(':')[0]);
      const end = parseCellRef(rawArgs[0].split(':')[1] || rawArgs[0].split(':')[0]);
      if (!start || !end) return '#REF!';
      const width = Math.abs(end.col - start.col) + 1;
      const rowIdx = getNumericValue(evaluatedArgs[1]) - 1;
      const colIdx = evaluatedArgs[2] !== undefined ? getNumericValue(evaluatedArgs[2]) - 1 : 0;
      const idx = rowIdx * width + colIdx;
      if (idx < 0 || idx >= refs.length) return '#REF!';
      const target = cells.get(refs[idx].toUpperCase());
      return target?.formula ? evaluateFormula(target.formula, cells, visited) : target?.value ?? '';
    }
    case 'XLOOKUP': {
      const lookup = evaluatedArgs[0];
      const lookupRange = getRangeComputed(rawArgs[1], cells, visited);
      const returnRange = getRangeComputed(rawArgs[2], cells, visited);
      for (let i = 0; i < lookupRange.length; i++) {
        if (evalCondition(lookupRange[i], lookup)) return returnRange[i] ?? '';
      }
      return evaluatedArgs[3] ?? '#N/A';
    }
  }
  return '#NAME?';
}

// ─── Tokenizer aware of strings & nested parens & comparisons ──
type Token = { type: 'num' | 'str' | 'ref' | 'fn' | 'op' | 'lparen' | 'rparen' | 'comma'; value: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = expr.length;
  while (i < len) {
    const ch = expr[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    // String
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let s = '';
      i++;
      while (i < len && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < len) { s += expr[i + 1]; i += 2; continue; }
        s += expr[i]; i++;
      }
      i++; // closing quote
      tokens.push({ type: 'str', value: s });
      continue;
    }
    // Number
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(expr[i + 1] || ''))) {
      let s = '';
      while (i < len && /[\d.]/.test(expr[i])) { s += expr[i]; i++; }
      // scientific notation
      if (i < len && (expr[i] === 'e' || expr[i] === 'E')) {
        s += expr[i]; i++;
        if (i < len && (expr[i] === '+' || expr[i] === '-')) { s += expr[i]; i++; }
        while (i < len && /\d/.test(expr[i])) { s += expr[i]; i++; }
      }
      tokens.push({ type: 'num', value: s });
      continue;
    }
    // Identifier (cell ref, range, function name, TRUE/FALSE)
    if (/[A-Za-z_$]/.test(ch)) {
      let s = '';
      while (i < len && /[A-Za-z0-9_$]/.test(expr[i])) { s += expr[i]; i++; }
      // Range continuation: A1:B2
      if (i < len && expr[i] === ':') {
        // peek
        let j = i + 1;
        let r = '';
        while (j < len && /[A-Za-z0-9$]/.test(expr[j])) { r += expr[j]; j++; }
        if (parseCellRef(r)) {
          s = s + ':' + r;
          i = j;
          tokens.push({ type: 'ref', value: s });
          continue;
        }
      }
      // Function call
      if (i < len && expr[i] === '(') {
        tokens.push({ type: 'fn', value: s.toUpperCase() });
        continue;
      }
      // TRUE/FALSE
      if (/^true$/i.test(s)) { tokens.push({ type: 'num', value: '1' }); continue; }
      if (/^false$/i.test(s)) { tokens.push({ type: 'num', value: '0' }); continue; }
      // Cell ref
      if (parseCellRef(s)) { tokens.push({ type: 'ref', value: s }); continue; }
      // Otherwise treat as bare string
      tokens.push({ type: 'str', value: s });
      continue;
    }
    // Operators (multi-char first)
    if (ch === '<' && expr[i + 1] === '=') { tokens.push({ type: 'op', value: '<=' }); i += 2; continue; }
    if (ch === '>' && expr[i + 1] === '=') { tokens.push({ type: 'op', value: '>=' }); i += 2; continue; }
    if (ch === '<' && expr[i + 1] === '>') { tokens.push({ type: 'op', value: '<>' }); i += 2; continue; }
    if ('+-*/^&=<>%'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue; }
    if (ch === ',' || ch === ';') { tokens.push({ type: 'comma', value: ',' }); i++; continue; }
    // Unknown char — skip
    i++;
  }
  return tokens;
}

// ─── Parser (recursive descent → AST) ───────────────────────────
type Node =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'ref'; value: string }
  | { type: 'range'; value: string }
  | { type: 'fn'; name: string; args: Node[]; rawArgs: string[] }
  | { type: 'unary'; op: string; operand: Node }
  | { type: 'binary'; op: string; left: Node; right: Node };

class Parser {
  tokens: Token[];
  pos = 0;
  constructor(tokens: Token[]) { this.tokens = tokens; }
  peek() { return this.tokens[this.pos]; }
  consume() { return this.tokens[this.pos++]; }

  parseExpression(): Node { return this.parseComparison(); }

  parseComparison(): Node {
    let left = this.parseConcat();
    while (this.peek() && this.peek().type === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parseConcat();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }
  parseConcat(): Node {
    let left = this.parseAddSub();
    while (this.peek() && this.peek().type === 'op' && this.peek().value === '&') {
      this.consume();
      const right = this.parseAddSub();
      left = { type: 'binary', op: '&', left, right };
    }
    return left;
  }
  parseAddSub(): Node {
    let left = this.parseMulDiv();
    while (this.peek() && this.peek().type === 'op' && ['+', '-'].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parseMulDiv();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }
  parseMulDiv(): Node {
    let left = this.parsePower();
    while (this.peek() && this.peek().type === 'op' && ['*', '/'].includes(this.peek().value)) {
      const op = this.consume().value;
      const right = this.parsePower();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }
  parsePower(): Node {
    let left = this.parseUnary();
    while (this.peek() && this.peek().type === 'op' && this.peek().value === '^') {
      this.consume();
      const right = this.parseUnary();
      left = { type: 'binary', op: '^', left, right };
    }
    return left;
  }
  parseUnary(): Node {
    if (this.peek() && this.peek().type === 'op' && (this.peek().value === '-' || this.peek().value === '+')) {
      const op = this.consume().value;
      return { type: 'unary', op, operand: this.parseUnary() };
    }
    let node = this.parsePostfix();
    return node;
  }
  parsePostfix(): Node {
    const node = this.parsePrimary();
    if (this.peek() && this.peek().type === 'op' && this.peek().value === '%') {
      this.consume();
      return { type: 'binary', op: '/', left: node, right: { type: 'num', value: 100 } };
    }
    return node;
  }
  parsePrimary(): Node {
    const t = this.consume();
    if (!t) throw new Error('#ERROR!');
    if (t.type === 'num') return { type: 'num', value: parseFloat(t.value) };
    if (t.type === 'str') return { type: 'str', value: t.value };
    if (t.type === 'ref') return t.value.includes(':') ? { type: 'range', value: t.value } : { type: 'ref', value: t.value };
    if (t.type === 'lparen') {
      const node = this.parseExpression();
      if (this.peek() && this.peek().type === 'rparen') this.consume();
      return node;
    }
    if (t.type === 'fn') {
      // expect (
      if (!this.peek() || this.peek().type !== 'lparen') throw new Error('#ERROR!');
      this.consume();
      const args: Node[] = [];
      const rawArgs: string[] = [];
      if (this.peek() && this.peek().type !== 'rparen') {
        // Track raw argument text by capturing depth-balanced slices
        let depth = 1;
        let argStart = this.pos;
        const startPosAbs = this.pos;
        // We need raw text — rebuild from tokens
        const collectRaw = (from: number, to: number) => {
          return this.tokens.slice(from, to).map((tk) => {
            if (tk.type === 'str') return `"${tk.value}"`;
            if (tk.type === 'lparen') return '(';
            if (tk.type === 'rparen') return ')';
            if (tk.type === 'comma') return ',';
            if (tk.type === 'fn') return tk.value;
            return tk.value;
          }).join('');
        };
        // Parse arguments while tracking raw text
        while (true) {
          // Find next top-level comma or matching rparen
          let argFrom = this.pos;
          let d = 1;
          let scan = this.pos;
          while (scan < this.tokens.length && d > 0) {
            const tk = this.tokens[scan];
            if (tk.type === 'lparen' || tk.type === 'fn') d++;
            else if (tk.type === 'rparen') { d--; if (d === 0) break; }
            else if (tk.type === 'comma' && d === 1) break;
            scan++;
          }
          const argTo = scan;
          rawArgs.push(collectRaw(argFrom, argTo));
          // Parse this argument as expression
          const subParser = new Parser(this.tokens.slice(argFrom, argTo));
          args.push(subParser.parseExpression());
          this.pos = scan;
          if (this.peek() && this.peek().type === 'comma') { this.consume(); continue; }
          break;
        }
      }
      if (this.peek() && this.peek().type === 'rparen') this.consume();
      return { type: 'fn', name: t.value, args, rawArgs };
    }
    if (t.type === 'op' && (t.value === '-' || t.value === '+')) {
      return { type: 'unary', op: t.value, operand: this.parsePrimary() };
    }
    throw new Error('#ERROR!');
  }
}

// ─── Evaluator ──────────────────────────────────────────────────
function evalNode(node: Node, cells: CellData, visited: Set<string>): CellValue {
  switch (node.type) {
    case 'num': return node.value;
    case 'str': return node.value;
    case 'ref': {
      const key = node.value.replace(/\$/g, '').toUpperCase();
      if (visited.has(key)) throw new Error('#REF!');
      const cell = cells.get(key);
      if (cell?.formula) return evaluateFormula(cell.formula, cells, new Set([...visited, key]));
      return cell?.value ?? 0;
    }
    case 'range': return 0; // ranges only valid inside functions
    case 'unary': {
      const v = evalNode(node.operand, cells, visited);
      if (node.op === '-') return -getNumericValue(v);
      return getNumericValue(v);
    }
    case 'binary': {
      const l = evalNode(node.left, cells, visited);
      const r = evalNode(node.right, cells, visited);
      switch (node.op) {
        case '+': return getNumericValue(l) + getNumericValue(r);
        case '-': return getNumericValue(l) - getNumericValue(r);
        case '*': return getNumericValue(l) * getNumericValue(r);
        case '/': {
          const d = getNumericValue(r);
          if (d === 0) throw new Error('#DIV/0!');
          return getNumericValue(l) / d;
        }
        case '^': return Math.pow(getNumericValue(l), getNumericValue(r));
        case '&': return getStringValue(l) + getStringValue(r);
        case '=': return isNumeric(l) && isNumeric(r) ? getNumericValue(l) === getNumericValue(r) : getStringValue(l) === getStringValue(r);
        case '<>': return isNumeric(l) && isNumeric(r) ? getNumericValue(l) !== getNumericValue(r) : getStringValue(l) !== getStringValue(r);
        case '<': return isNumeric(l) && isNumeric(r) ? getNumericValue(l) < getNumericValue(r) : getStringValue(l) < getStringValue(r);
        case '>': return isNumeric(l) && isNumeric(r) ? getNumericValue(l) > getNumericValue(r) : getStringValue(l) > getStringValue(r);
        case '<=': return isNumeric(l) && isNumeric(r) ? getNumericValue(l) <= getNumericValue(r) : getStringValue(l) <= getStringValue(r);
        case '>=': return isNumeric(l) && isNumeric(r) ? getNumericValue(l) >= getNumericValue(r) : getStringValue(l) >= getStringValue(r);
      }
      return 0;
    }
    case 'fn': {
      const name = node.name.toUpperCase();
      if (RANGE_AWARE.has(name)) {
        const evaluatedArgs = node.args.map((a) => {
          if (a.type === 'range') return null;
          return evalNode(a, cells, visited);
        });
        return evaluateRangeFunction(name, node.rawArgs, evaluatedArgs, cells, visited);
      }
      // Expand range arguments into list of values
      const evaluated: CellValue[] = [];
      for (const a of node.args) {
        if (a.type === 'range') {
          const vals = getRangeComputed(a.value, cells, visited);
          evaluated.push(...vals);
        } else {
          evaluated.push(evalNode(a, cells, visited));
        }
      }
      const fn = functions[name];
      if (!fn) throw new Error('#NAME?');
      return fn(evaluated);
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────
export function evaluateFormula(formula: string, cells: CellData, visited: Set<string> = new Set()): CellValue {
  try {
    const expr = formula.startsWith('=') ? formula.slice(1) : formula;
    const tokens = tokenize(expr);
    if (!tokens.length) return '';
    const parser = new Parser(tokens);
    const ast = parser.parseExpression();
    const result = evalNode(ast, cells, visited);
    if (typeof result === 'number' && !isFinite(result)) return '#NUM!';
    return result;
  } catch (e) {
    return e instanceof Error && e.message.startsWith('#') ? e.message : '#ERROR!';
  }
}

export function getFormulaDependencies(formula: string): string[] {
  const deps = new Set<string>();
  const expr = formula.startsWith('=') ? formula.slice(1) : formula;
  // Expand ranges
  const rangeRe = /(\$?[A-Z]+\$?\d+):(\$?[A-Z]+\$?\d+)/gi;
  let match;
  let cleaned = expr;
  while ((match = rangeRe.exec(expr)) !== null) {
    const refs = parseRange(match[0]);
    refs.forEach((r) => deps.add(r.toUpperCase()));
  }
  cleaned = expr.replace(rangeRe, '');
  // Single refs
  const refRe = /\$?[A-Z]+\$?\d+/gi;
  while ((match = refRe.exec(cleaned)) !== null) {
    deps.add(match[0].replace(/\$/g, '').toUpperCase());
  }
  return [...deps];
}

export function hasCircularReference(cellRef: string, formula: string, cells: CellData): boolean {
  const target = cellRef.toUpperCase();
  const visited = new Set<string>();
  const stack: string[] = getFormulaDependencies(formula);
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === target) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const c = cells.get(cur);
    if (c?.formula) stack.push(...getFormulaDependencies(c.formula));
  }
  return false;
}

// Translate cell refs in a formula by row/col offset (for fill/copy-paste)
export function translateFormula(formula: string, dRow: number, dCol: number): string {
  const expr = formula.startsWith('=') ? formula.slice(1) : formula;
  const translated = expr.replace(/(\$?)([A-Z]+)(\$?)(\d+)/gi, (_m, ac, col, ar, row) => {
    const newCol = ac === '$' ? col : colIndexToLetter(letterToColIndex(col.toUpperCase()) + dCol);
    const newRow = ar === '$' ? row : String(parseInt(row, 10) + dRow);
    return `${ac}${newCol}${ar}${newRow}`;
  });
  return '=' + translated;
}

// List of supported function names (for autocomplete)
export const SUPPORTED_FUNCTIONS = [
  ...Object.keys(functions),
  ...Array.from(RANGE_AWARE),
].sort();
