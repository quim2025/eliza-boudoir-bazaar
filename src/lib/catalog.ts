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

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const FREE_SHIPPING_FROM = 299;
export const SHIPPING_FEE = 19.9;
