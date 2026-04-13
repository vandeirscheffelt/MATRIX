import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(value: number, type: 'currency' | 'percent' | 'number' = 'number') {
  if (type === 'currency')
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (type === 'percent')
    return `${(value * 100).toFixed(2)}%`
  return value.toLocaleString('pt-BR')
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}
