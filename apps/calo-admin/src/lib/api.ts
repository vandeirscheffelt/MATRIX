const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ADMIN_KEY = process.env.NEXT_PUBLIC_CALO_ADMIN_KEY ?? ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Calo-Admin-Key': ADMIN_KEY,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Birds ───────────────────────────────────────────────────────────────────
export const api = {
  birds: {
    list: (params?: Record<string, string>) => {
      const q = new URLSearchParams(params).toString()
      return request<any>(`/calo/birds${q ? `?${q}` : ''}`)
    },
    get: (id: string) => request<any>(`/calo/birds/${id}`),
    create: (data: any) => request<any>('/calo/admin/birds', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/calo/admin/birds/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/calo/admin/birds/${id}`, { method: 'DELETE' }),
  },
  parents: {
    list: (params?: Record<string, string>) => {
      const q = new URLSearchParams(params).toString()
      return request<any>(`/calo/admin/parents${q ? `?${q}` : ''}`)
    },
    create: (data: any) => request<any>('/calo/admin/parents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/calo/admin/parents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/calo/admin/parents/${id}`, { method: 'DELETE' }),
  },
  orders: {
    list: (params?: Record<string, string>) => {
      const q = new URLSearchParams(params).toString()
      return request<any>(`/calo/admin/orders${q ? `?${q}` : ''}`)
    },
    get: (id: string) => request<any>(`/calo/orders/${id}`),
    updateStatus: (id: string, status: string) =>
      request<any>(`/calo/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
  buyers: {
    list: (params?: Record<string, string>) => {
      const q = new URLSearchParams(params).toString()
      return request<any>(`/calo/admin/buyers${q ? `?${q}` : ''}`)
    },
    get: (id: string) => request<any>(`/calo/admin/buyers/${id}`),
    create: (data: any) => request<any>('/calo/admin/buyers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/calo/admin/buyers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/calo/admin/buyers/${id}`, { method: 'DELETE' }),
  },
  breeders: {
    list: () => request<any>('/calo/admin/breeders'),
  },
}
