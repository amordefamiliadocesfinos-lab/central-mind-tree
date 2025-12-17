import { 
  startOfWeek as fnsStartOfWeek, 
  endOfWeek as fnsEndOfWeek, 
  format, 
  parseISO,
  addDays,
  isSameDay,
  isBefore,
  isAfter,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// Timezone: America/Sao_Paulo (BRT = UTC-3)
const SAO_PAULO_OFFSET = -3 * 60; // -180 minutes

/**
 * Get current date in Sao Paulo timezone
 */
export const getNowSaoPaulo = (): Date => {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcTime + SAO_PAULO_OFFSET * 60000);
};

/**
 * Get today's date in ISO format (YYYY-MM-DD) in Sao Paulo timezone
 */
export const getTodayISO = (): string => {
  return format(getNowSaoPaulo(), "yyyy-MM-dd");
};

/**
 * Get start of week (Monday) in Sao Paulo timezone
 */
export const getWeekStartSaoPaulo = (date?: Date): Date => {
  const targetDate = date || getNowSaoPaulo();
  return fnsStartOfWeek(targetDate, { weekStartsOn: 1 }); // Monday
};

/**
 * Get end of week (Sunday) in Sao Paulo timezone
 */
export const getWeekEndSaoPaulo = (date?: Date): Date => {
  const targetDate = date || getNowSaoPaulo();
  return fnsEndOfWeek(targetDate, { weekStartsOn: 1 }); // Sunday
};

/**
 * Get week start ISO string
 */
export const getWeekStartISO = (date?: Date): string => {
  return getWeekStartSaoPaulo(date).toISOString();
};

/**
 * Format date for display in PT-BR locale
 */
export const formatDatePtBR = (date: Date | string, formatStr: string = "dd/MM/yyyy"): string => {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, formatStr, { locale: ptBR });
};

/**
 * Format date range for week display
 */
export const formatWeekRange = (date?: Date): string => {
  const start = getWeekStartSaoPaulo(date);
  const end = getWeekEndSaoPaulo(date);
  return `${format(start, "dd/MM", { locale: ptBR })} - ${format(end, "dd/MM", { locale: ptBR })}`;
};

/**
 * Get all days of the current week
 */
export const getWeekDays = (date?: Date): Date[] => {
  const start = getWeekStartSaoPaulo(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/**
 * Get day name abbreviation
 */
export const getDayAbbr = (date: Date): string => {
  return format(date, "EEE", { locale: ptBR });
};

/**
 * Check if date is today (in Sao Paulo timezone)
 */
export const isToday = (date: Date | string): boolean => {
  const d = typeof date === "string" ? parseISO(date) : date;
  return isSameDay(d, getNowSaoPaulo());
};

/**
 * Check if date is in the past (in Sao Paulo timezone)
 */
export const isPast = (date: Date | string): boolean => {
  const d = typeof date === "string" ? parseISO(date) : date;
  const today = getNowSaoPaulo();
  today.setHours(0, 0, 0, 0);
  return isBefore(d, today);
};

/**
 * Check if date is in the future (in Sao Paulo timezone)
 */
export const isFuture = (date: Date | string): boolean => {
  const d = typeof date === "string" ? parseISO(date) : date;
  const today = getNowSaoPaulo();
  today.setHours(23, 59, 59, 999);
  return isAfter(d, today);
};

/**
 * Convert any date to ISO string (YYYY-MM-DD)
 */
export const toISODateString = (date: Date | string): string => {
  if (typeof date === "string") {
    // Already a string, validate and return
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    return format(parseISO(date), "yyyy-MM-dd");
  }
  return format(date, "yyyy-MM-dd");
};

/**
 * Parse ISO date string safely
 */
export const parseISOSafe = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  try {
    return parseISO(dateStr);
  } catch {
    return null;
  }
};

/**
 * Check if it's Friday afternoon (after 16:00) in Sao Paulo
 */
export const isFridayAfternoon = (): boolean => {
  const now = getNowSaoPaulo();
  const dayOfWeek = now.getDay(); // 5 = Friday
  const hour = now.getHours();
  return dayOfWeek === 5 && hour >= 16;
};

/**
 * Check if it's Monday morning (08:00-12:00) in Sao Paulo
 */
export const isMondayMorning = (): boolean => {
  const now = getNowSaoPaulo();
  const dayOfWeek = now.getDay(); // 1 = Monday
  const hour = now.getHours();
  return dayOfWeek === 1 && hour >= 8 && hour < 12;
};

/**
 * Get the start of the current week as epoch milliseconds
 */
export const getWeekStartEpoch = (): number => {
  return getWeekStartSaoPaulo().getTime();
};
