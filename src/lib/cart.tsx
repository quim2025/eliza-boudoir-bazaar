import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  variantId: string;
  productId: string;
  name: string;
  size: string;
  color: string;
  price: number;
  imageKey: string;
  quantity: number;
};

type CartCtx = {
  items: CartItem[];
  add: (item: CartItem) => void;
  setQty: (variantId: string, q: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "eliza-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch (err) {
      console.warn("Falha ao carregar carrinho do localStorage", err);
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, loaded]);

  const value: CartCtx = {
    items,
    add: (item) =>
      setItems((prev) => {
        const ex = prev.find((i) => i.variantId === item.variantId);
        if (ex)
          return prev.map((i) =>
            i.variantId === item.variantId ? { ...i, quantity: i.quantity + item.quantity } : i,
          );
        return [...prev, item];
      }),
    setQty: (id, q) =>
      setItems((prev) =>
        prev.map((i) => (i.variantId === id ? { ...i, quantity: Math.max(1, q) } : i)),
      ),
    remove: (id) => setItems((prev) => prev.filter((i) => i.variantId !== id)),
    clear: () => setItems([]),
    count: items.reduce((s, i) => s + i.quantity, 0),
    subtotal: items.reduce((s, i) => s + i.quantity * i.price, 0),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart fora do CartProvider");
  return c;
}
