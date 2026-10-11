import lingerie from "@/assets/cat-lingerie.jpg";
import intimas from "@/assets/cat-intimas.jpg";
import pijamas from "@/assets/cat-pijamas.jpg";
import pijamasInfantis from "@/assets/cat-pijamas-infantis.jpg";
import intimasInfantis from "@/assets/cat-intimas-infantis.jpg";

export const CATEGORIES = [
  { slug: "lingerie", label: "Lingerie", image: lingerie },
  { slug: "intimas-femininas", label: "Roupas Íntimas", image: intimas },
  { slug: "pijamas-femininos", label: "Pijamas Femininos", image: pijamas },
  { slug: "pijamas-infantis", label: "Pijamas Infantis", image: pijamasInfantis },
  { slug: "intimas-infantis", label: "Íntimas Infantis", image: intimasInfantis },
] as const;

const IMAGES: Record<string, string> = {
  lingerie,
  intimas,
  pijamas,
  "pijamas-infantis": pijamasInfantis,
  "intimas-infantis": intimasInfantis,
};

export const productImage = (key: string) => {
  if (!key) return lingerie;
  if (
    key.startsWith("http://") ||
    key.startsWith("https://") ||
    key.startsWith("data:") ||
    key.startsWith("blob:")
  ) {
    return key;
  }
  return IMAGES[key] ?? lingerie;
};
export const categoryLabel = (slug: string) =>
  CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const FREE_SHIPPING_FROM = 299;
export const SHIPPING_FEE = 19.9;

export interface MockProductVariant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  color_hex: string;
  stock: number;
}

export interface MockProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image_key: string;
  active: boolean;
  created_at: string;
  product_variants: MockProductVariant[];
}

export const DEFAULT_MOCK_PRODUCTS: MockProduct[] = [
  {
    id: "p1",
    name: "Conjunto Rendado Aurora",
    description: "Sutiã com bojo e calcinha em renda francesa delicada.",
    category: "lingerie",
    price: 189.9,
    image_key: "lingerie",
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    product_variants: [
      { id: "v1-1", product_id: "p1", size: "P", color: "Rosé", color_hex: "#D9A5A0", stock: 12 },
      { id: "v1-2", product_id: "p1", size: "M", color: "Preto", color_hex: "#1E1A1A", stock: 10 },
      { id: "v1-3", product_id: "p1", size: "G", color: "Marfim", color_hex: "#F1E9DC", stock: 8 },
    ],
  },
  {
    id: "p2",
    name: "Body Rendado Noir",
    description: "Body em renda com alças finas e acabamento acetinado.",
    category: "lingerie",
    price: 229.9,
    image_key: "lingerie",
    active: true,
    created_at: "2026-01-02T00:00:00.000Z",
    product_variants: [
      { id: "v2-1", product_id: "p2", size: "P", color: "Preto", color_hex: "#1E1A1A", stock: 8 },
      { id: "v2-2", product_id: "p2", size: "M", color: "Preto", color_hex: "#1E1A1A", stock: 6 },
    ],
  },
  {
    id: "p3",
    name: "Calcinha Algodão Essencial",
    description: "Kit com 3 calcinhas em algodão macio para o dia a dia.",
    category: "intimas-femininas",
    price: 69.9,
    image_key: "intimas",
    active: true,
    created_at: "2026-01-03T00:00:00.000Z",
    product_variants: [
      { id: "v3-1", product_id: "p3", size: "M", color: "Marfim", color_hex: "#F1E9DC", stock: 15 },
      { id: "v3-2", product_id: "p3", size: "G", color: "Rosé", color_hex: "#D9A5A0", stock: 12 },
    ],
  },
  {
    id: "p4",
    name: "Sutiã Sem Bojo Conforto",
    description: "Sutiã em microfibra sem aro, toque suave.",
    category: "intimas-femininas",
    price: 89.9,
    image_key: "intimas",
    active: true,
    created_at: "2026-01-04T00:00:00.000Z",
    product_variants: [
      { id: "v4-1", product_id: "p4", size: "M", color: "Rosé", color_hex: "#D9A5A0", stock: 9 },
      { id: "v4-2", product_id: "p4", size: "G", color: "Preto", color_hex: "#1E1A1A", stock: 14 },
    ],
  },
  {
    id: "p5",
    name: "Pijama Cetim Lua",
    description: "Camisa e calça em cetim com debrum contrastante.",
    category: "pijamas-femininos",
    price: 249.9,
    image_key: "pijamas",
    active: true,
    created_at: "2026-01-05T00:00:00.000Z",
    product_variants: [
      { id: "v5-1", product_id: "p5", size: "P", color: "Rosé", color_hex: "#D9A5A0", stock: 10 },
      { id: "v5-2", product_id: "p5", size: "M", color: "Marfim", color_hex: "#F1E9DC", stock: 10 },
    ],
  },
  {
    id: "p6",
    name: "Camisola Viscose Flor",
    description: "Camisola leve em viscose com estampa floral.",
    category: "pijamas-femininos",
    price: 139.9,
    image_key: "pijamas",
    active: true,
    created_at: "2026-01-06T00:00:00.000Z",
    product_variants: [
      { id: "v6-1", product_id: "p6", size: "M", color: "Rosé", color_hex: "#D9A5A0", stock: 7 },
      { id: "v6-2", product_id: "p6", size: "G", color: "Marfim", color_hex: "#F1E9DC", stock: 5 },
    ],
  },
  {
    id: "p7",
    name: "Pijama Infantil Estrelinhas",
    description: "Pijama de algodão com estampa de estrelas.",
    category: "pijamas-infantis",
    price: 99.9,
    image_key: "pijamas-infantis",
    active: true,
    created_at: "2026-01-07T00:00:00.000Z",
    product_variants: [
      { id: "v7-1", product_id: "p7", size: "6", color: "Rosé", color_hex: "#D9A5A0", stock: 12 },
      { id: "v7-2", product_id: "p7", size: "8", color: "Marfim", color_hex: "#F1E9DC", stock: 8 },
    ],
  },
  {
    id: "p8",
    name: "Kit Calcinha Infantil Arco-íris",
    description: "Kit com 5 calcinhas infantis em algodão.",
    category: "intimas-infantis",
    price: 59.9,
    image_key: "intimas-infantis",
    active: true,
    created_at: "2026-01-08T00:00:00.000Z",
    product_variants: [
      { id: "v8-1", product_id: "p8", size: "4", color: "Rosé", color_hex: "#D9A5A0", stock: 14 },
      { id: "v8-2", product_id: "p8", size: "6", color: "Marfim", color_hex: "#F1E9DC", stock: 11 },
    ],
  },
];

export const getMockProducts = (category?: string): MockProduct[] => {
  if (!category) return DEFAULT_MOCK_PRODUCTS;
  return DEFAULT_MOCK_PRODUCTS.filter((p) => p.category === category);
};

export const getMockProduct = (id: string): MockProduct | undefined => {
  return DEFAULT_MOCK_PRODUCTS.find((p) => p.id === id);
};
