import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor numérico como moeda brasileira (R$)
 */
export function formatCurrency(value: number, options?: { compact?: boolean }): string {
  if (options?.compact && value >= 1000) {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
