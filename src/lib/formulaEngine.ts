// Custom formula engine with A1 notation support
// Supports: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, ROUND, ABS, TODAY, NOW

export type CellValue = string | number | boolean | null;
export type CellData = Map<string, { value: CellValue; formula?: string }>;

// Convert column index to letter (0 = A, 1 = B, etc.)
export function colIndexToLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

// Convert column letter to index (A = 0, B = 1, etc.)
export function letterToColIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

// Parse cell reference like "A1" to { col: 0, row: 0 }
export function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return {
    col: letterToColIndex(match[1].toUpperCase()),
    row: parseInt(match[2], 10) - 1,
  };
}

// Create cell key from row and col indices
export function cellKey(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`;
}

// Parse range like "A1:B10" to array of cell references
function parseRange(range: string): string[] {
  const parts = range.split(':');
  if (parts.length !== 2) return [range];

  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return [range];

  const cells: string[] = [];
  for (let row = start.row; row <= end.row; row++) {
    for (let col = start.col; col <= end.col; col++) {
      cells.push(cellKey(row, col));
    }
  }
  return cells;
}

// Get numeric value from cell
function getNumericValue(value: CellValue): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return 0;
}

// Get values from cells for a range/reference
function getCellValues(args: string[], cells: CellData): CellValue[] {
  const values: CellValue[] = [];
  for (const arg of args) {
    const trimmed = arg.trim();
    // Check if it's a range
    if (trimmed.includes(':')) {
      const refs = parseRange(trimmed);
      for (const ref of refs) {
        const cell = cells.get(ref.toUpperCase());
        values.push(cell?.value ?? null);
      }
    }
    // Check if it's a cell reference
    else if (/^[A-Z]+\d+$/i.test(trimmed)) {
      const cell = cells.get(trimmed.toUpperCase());
      values.push(cell?.value ?? null);
    }
    // It's a literal value
    else {
      const num = parseFloat(trimmed);
      if (!isNaN(num)) {
        values.push(num);
      } else if (trimmed.toLowerCase() === 'true') {
        values.push(true);
      } else if (trimmed.toLowerCase() === 'false') {
        values.push(false);
      } else {
        // Remove quotes if present
        values.push(trimmed.replace(/^["']|["']$/g, ''));
      }
    }
  }
  return values;
}

// Built-in functions
const functions: Record<string, (args: CellValue[]) => CellValue> = {
  SUM: (args) => args.reduce((sum: number, v) => sum + getNumericValue(v), 0),
  
  AVERAGE: (args: CellValue[]) => {
    const validArgs = args.filter((v) => v !== null && v !== '');
    const count = validArgs.length;
    if (count === 0) return 0;
    let sum = 0;
    for (const v of validArgs) {
      sum += getNumericValue(v);
    }
    return sum / count;
  },
  
  MIN: (args) => {
    const nums = args.map(getNumericValue).filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.min(...nums) : 0;
  },
  
  MAX: (args) => {
    const nums = args.map(getNumericValue).filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
  
  COUNT: (args) => args.filter((v) => typeof v === 'number' || (typeof v === 'string' && !isNaN(parseFloat(v)))).length,
  
  COUNTA: (args) => args.filter((v) => v !== null && v !== '').length,
  
  IF: (args) => {
    const [condition, trueVal, falseVal] = args;
    return condition ? (trueVal ?? true) : (falseVal ?? false);
  },
  
  ROUND: (args) => {
    const num = getNumericValue(args[0]);
    const decimals = args[1] !== undefined ? getNumericValue(args[1]) : 0;
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  },
  
  ABS: (args) => Math.abs(getNumericValue(args[0])),
  
  TODAY: () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  },
  
  NOW: () => new Date().toISOString(),
};

// Tokenize formula into parts
function tokenize(formula: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let parenDepth = 0;

  for (let i = 0; i < formula.length; i++) {
    const char = formula[i];

    if (inString) {
      current += char;
      if (char === stringChar) {
        inString = false;
      }
    } else if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      current += char;
    } else if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth--;
      current += char;
    } else if (parenDepth === 0 && ['+', '-', '*', '/', '^'].includes(char)) {
      if (current.trim()) tokens.push(current.trim());
      tokens.push(char);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

// Parse and evaluate a function call
function evaluateFunction(expr: string, cells: CellData, visited: Set<string>): CellValue {
  const match = expr.match(/^([A-Z]+)\((.*)\)$/i);
  if (!match) return expr;

  const funcName = match[1].toUpperCase();
  const argsStr = match[2];

  // Parse arguments (handle nested functions and commas)
  const args: string[] = [];
  let current = '';
  let parenDepth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];

    if (inString) {
      current += char;
      if (char === stringChar) inString = false;
    } else if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      current += char;
    } else if (char === '(') {
      parenDepth++;
      current += char;
    } else if (char === ')') {
      parenDepth--;
      current += char;
    } else if (char === ',' && parenDepth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) args.push(current.trim());

  // Evaluate each argument
  const evaluatedArgs: CellValue[] = [];
  for (const arg of args) {
    const trimmed = arg.trim();
    
    // Check if it's a range
    if (trimmed.includes(':')) {
      const values = getCellValues([trimmed], cells);
      evaluatedArgs.push(...values);
    }
    // Check if it's a function call
    else if (/^[A-Z]+\(/i.test(trimmed)) {
      evaluatedArgs.push(evaluateExpression(trimmed, cells, visited));
    }
    // Check if it's a cell reference
    else if (/^[A-Z]+\d+$/i.test(trimmed)) {
      const cellRef = trimmed.toUpperCase();
      if (visited.has(cellRef)) {
        throw new Error('#REF!'); // Circular reference
      }
      const cell = cells.get(cellRef);
      if (cell?.formula) {
        evaluatedArgs.push(evaluateFormula(cell.formula, cells, new Set([...visited, cellRef])));
      } else {
        evaluatedArgs.push(cell?.value ?? null);
      }
    }
    // It's a literal
    else {
      const values = getCellValues([trimmed], cells);
      evaluatedArgs.push(...values);
    }
  }

  const func = functions[funcName];
  if (!func) throw new Error('#NAME?');

  return func(evaluatedArgs);
}

// Evaluate an expression (handles operators and function calls)
function evaluateExpression(expr: string, cells: CellData, visited: Set<string>): CellValue {
  const trimmed = expr.trim();

  // Check if it's a function call
  if (/^[A-Z]+\(/i.test(trimmed)) {
    return evaluateFunction(trimmed, cells, visited);
  }

  // Check if it's a cell reference
  if (/^[A-Z]+\d+$/i.test(trimmed)) {
    const cellRef = trimmed.toUpperCase();
    if (visited.has(cellRef)) {
      throw new Error('#REF!');
    }
    const cell = cells.get(cellRef);
    if (cell?.formula) {
      return evaluateFormula(cell.formula, cells, new Set([...visited, cellRef]));
    }
    return cell?.value ?? 0;
  }

  // Check if it's a number
  const num = parseFloat(trimmed);
  if (!isNaN(num)) return num;

  // Check for parentheses
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return evaluateExpression(trimmed.slice(1, -1), cells, visited);
  }

  // Tokenize and evaluate operators
  const tokens = tokenize(trimmed);
  if (tokens.length === 1) {
    return evaluateExpression(tokens[0], cells, visited);
  }

  // Handle operators with precedence
  // First pass: ^ (exponentiation)
  // Second pass: * /
  // Third pass: + -
  const operators = [
    ['^'],
    ['*', '/'],
    ['+', '-'],
  ];

  let values: CellValue[] = [];
  let ops: string[] = [];

  // Parse tokens into values and operators
  for (const token of tokens) {
    if (['+', '-', '*', '/', '^'].includes(token)) {
      ops.push(token);
    } else {
      values.push(evaluateExpression(token, cells, visited));
    }
  }

  // Apply operators by precedence
  for (const opGroup of operators) {
    let i = 0;
    while (i < ops.length) {
      if (opGroup.includes(ops[i])) {
        const left = getNumericValue(values[i]);
        const right = getNumericValue(values[i + 1]);
        let result: number;

        switch (ops[i]) {
          case '^':
            result = Math.pow(left, right);
            break;
          case '*':
            result = left * right;
            break;
          case '/':
            if (right === 0) throw new Error('#DIV/0!');
            result = left / right;
            break;
          case '+':
            result = left + right;
            break;
          case '-':
            result = left - right;
            break;
          default:
            result = 0;
        }

        values.splice(i, 2, result);
        ops.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  return values[0];
}

// Main formula evaluation function
export function evaluateFormula(
  formula: string,
  cells: CellData,
  visited: Set<string> = new Set()
): CellValue {
  // Remove leading = if present
  const expr = formula.startsWith('=') ? formula.slice(1) : formula;

  try {
    return evaluateExpression(expr, cells, visited);
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return '#ERROR!';
  }
}

// Get all cell references from a formula (for dependency tracking)
export function getFormulaDependencies(formula: string): string[] {
  const deps: string[] = [];
  const cellRefRegex = /[A-Z]+\d+/gi;
  const rangeRegex = /([A-Z]+\d+):([A-Z]+\d+)/gi;

  // First, extract ranges and expand them
  let match;
  while ((match = rangeRegex.exec(formula)) !== null) {
    const refs = parseRange(match[0]);
    deps.push(...refs);
  }

  // Then extract individual cell references (that aren't part of ranges)
  const formulaWithoutRanges = formula.replace(rangeRegex, '');
  while ((match = cellRefRegex.exec(formulaWithoutRanges)) !== null) {
    deps.push(match[0].toUpperCase());
  }

  return [...new Set(deps)];
}

// Check for circular references
export function hasCircularReference(
  cellRef: string,
  formula: string,
  cells: CellData
): boolean {
  const visited = new Set<string>();
  const stack = [cellRef];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const cell = cells.get(current);
    const formulaToCheck = current === cellRef ? formula : cell?.formula;

    if (formulaToCheck) {
      const deps = getFormulaDependencies(formulaToCheck);
      for (const dep of deps) {
        if (dep === cellRef) return true;
        stack.push(dep);
      }
    }
  }

  return false;
}
