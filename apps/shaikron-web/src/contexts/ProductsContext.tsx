import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface Product {
  id: string;
  product_name: string;
  short_description: string;
  status: "active" | "coming_soon";
  external_link: string;
  icon: string;
  highlight_badge: string;
  display_order: number;
}

interface ProductsState {
  products: Product[];
  addProduct: (product: Omit<Product, "id">) => void;
  updateProduct: (id: string, updates: Partial<Omit<Product, "id">>) => void;
  deleteProduct: (id: string) => void;
}

const STORAGE_KEY = "schaikron_products";

function loadProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

const ProductsContext = createContext<ProductsState>({
  products: [],
  addProduct: () => {},
  updateProduct: () => {},
  deleteProduct: () => {},
});

export const ProductsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(loadProducts);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  const addProduct = useCallback((product: Omit<Product, "id">) => {
    setProducts(prev => [...prev, { ...product, id: crypto.randomUUID() }]);
  }, []);

  const updateProduct = useCallback((id: string, updates: Partial<Omit<Product, "id">>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  return (
    <ProductsContext.Provider value={{ products, addProduct, updateProduct, deleteProduct }}>
      {children}
    </ProductsContext.Provider>
  );
};

export const useProducts = () => useContext(ProductsContext);
