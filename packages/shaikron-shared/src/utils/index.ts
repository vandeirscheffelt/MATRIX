// Shared utility functions

export function assertTenantId(empresaId: string | undefined): string {
  if (!empresaId) throw new Error("empresaId is required (tenant isolation)");
  return empresaId;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
