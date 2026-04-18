// Shared domain types across Shaikron products

export type TenantId = string;
export type UserId = string;
export type ProfissionalId = string;

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export type StatusAgendamento =
  | "PENDENTE"
  | "CONFIRMADO"
  | "CANCELADO"
  | "CONCLUIDO";

export type StatusIA = "ATIVO" | "PAUSADO";
