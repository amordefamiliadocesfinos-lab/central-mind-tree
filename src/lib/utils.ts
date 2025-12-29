import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor numérico como moeda brasileira (R$)
 * Usa precisão máxima para exibição (até 10 casas decimais se necessário)
 */
export function formatCurrency(value: number, options?: { compact?: boolean; maxDecimals?: number }): string {
  if (options?.compact && value >= 1000) {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  
  // Determinar casas decimais necessárias (mínimo 2, máximo configurável)
  const maxDecimals = options?.maxDecimals ?? 10;
  const str = value.toString();
  const decimalPart = str.includes('.') ? str.split('.')[1] : '';
  const neededDecimals = Math.max(2, Math.min(decimalPart.length, maxDecimals));
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: neededDecimals,
  }).format(value);
}

/**
 * Formata um número com precisão total (sem arredondamento)
 * Útil para quantidades e medidas que precisam de precisão exata
 */
export function formatNumber(value: number, options?: { maxDecimals?: number; unit?: string }): string {
  const maxDecimals = options?.maxDecimals ?? 10;
  const str = value.toString();
  const decimalPart = str.includes('.') ? str.split('.')[1] : '';
  const neededDecimals = Math.min(decimalPart.length, maxDecimals);
  
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: neededDecimals,
  }).format(value);
  
  return options?.unit ? `${formatted} ${options.unit}` : formatted;
}
