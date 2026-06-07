import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "@/lib/apiClient";

export type ProductCategory =
  | "apps"
  | "financas"
  | "beleza"
  | "performance"
  | "sono"
  | "emagrecimento";

export interface Product {
  id: string;
  product_name: string;
  short_description: string;
  status: "active" | "coming_soon";
  external_link: string;
  icon: string;
  highlight_badge: string;
  display_order: number;
  category?: ProductCategory;
  display_mode?: "icon" | "catalog";
  images?: string[];
}

interface ProductsState {
  products: Product[];
  loading: boolean;
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Omit<Product, "id">>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const ProductsContext = createContext<ProductsState>({
  products: [],
  loading: false,
  addProduct: async () => {},
  updateProduct: async () => {},
  deleteProduct: async () => {},
  refetch: async () => {},
});

export const ProductsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await api.get<Product[]>("/marketplace/public");
      setProducts(data);
    } catch {
      // falha silenciosa — array vazio
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const addProduct = useCallback(async (product: Omit<Product, "id">) => {
    const created = await api.post<Product>("/admin/marketplace", product);
    setProducts((prev) => [...prev, created]);
  }, []);

  const updateProduct = useCallback(async (id: string, updates: Partial<Omit<Product, "id">>) => {
    const updated = await api.patch<Product>(`/admin/marketplace/${id}`, updates);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await api.delete(`/admin/marketplace/${id}`);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <ProductsContext.Provider value={{ products, loading, addProduct, updateProduct, deleteProduct, refetch: fetchProducts }}>
      {children}
    </ProductsContext.Provider>
  );
};

export const useProducts = () => useContext(ProductsContext);
