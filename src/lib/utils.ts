import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

import { expandAbbreviations, formatProductTitle } from "../utils/abbreviations";

export { expandAbbreviations, formatProductTitle };

export function formatCapitalized(text?: string | null): string {
  if (!text) return '';
  return formatProductTitle(text);
}

/**
 * Converte data de YYYY-MM-DD para DD-MM-YYYY (ou DD/MM/YYYY).
 * Ex: '2026-11-03' -> '03-11-2026'
 */
export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (match) {
    const [, yyyy, mm, dd, rest] = match;
    return `${dd}-${mm}-${yyyy}${rest || ''}`;
  }
  return clean;
}

/**
 * Converte todas as ocorrências de datas invertidas (YYYY-MM-DD) encontradas dentro de um texto/mensagem para DD-MM-YYYY.
 * Ex: "está agendado para 2026-11-03 às 12:00" -> "está agendado para 03-11-2026 às 12:00"
 */
export function formatAllDatesBR(text?: string | null): string {
  if (!text) return '';
  return String(text).replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3-$2-$1');
}


