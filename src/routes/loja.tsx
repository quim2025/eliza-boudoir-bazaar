import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, brl, categoryLabel, productImage, getMockProducts } from "@/lib/catalog";

type Search = { categoria?: string };

export const Route = createFileRoute("/loja")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    categoria: typeof s.categoria === "string" ? s.categoria : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Loja — Eliza Lingerie" },
      {
        name: "description",
        content: "Compre lingerie, roupas íntimas e pijamas femininos e infantis.",
      },
      { property: "og:title", content: "Loja — Eliza Lingerie" },
      { property: "og:description", content: "Todas as peças da Eliza Lingerie em um só lugar." },
    ],
  }),
  component: Loja,
});

function Loja() {
  const { categoria } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["products", categoria ?? "all"],
    queryFn: async () => {
      try {
        let q = supabase
          .from("products")
          .select("*, product_variants(color, color_hex)")
          .eq("active", true)
          .order("created_at");
        if (categoria) q = q.eq("category", categoria);
        const { data, error } = await q;
        if (error || !data || data.length === 0) {
          return getMockProducts(categoria);
        }
        return data;
      } catch (err) {
        console.warn("Usando catálogo demonstrativo:", err);
        return getMockProducts(categoria);
      }
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-5xl">{categoria ? categoryLabel(categoria) : "Toda a loja"}</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/loja"
          className={`eyebrow border px-4 py-2 ${!categoria ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
        >
          Tudo
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            to="/loja"
            search={{ categoria: c.slug }}
            className={`eyebrow border px-4 py-2 ${categoria === c.slug ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
          >
            {c.label}
          </Link>
        ))}
      </div>
      {isLoading ? (
        <p className="mt-12 text-muted-foreground">Carregando…</p>
      ) : !data?.length ? (
        <p className="mt-12 text-muted-foreground">Nenhum produto nesta categoria ainda.</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {data.map((p) => {
            const colors = Array.from(
              new Map(p.product_variants.map((v) => [v.color, v.color_hex])).values(),
            );
            return (
              <Link key={p.id} to="/produto/$id" params={{ id: p.id }} className="group">
                <div className="overflow-hidden bg-muted">
                  <img
                    src={productImage(p.image_key)}
                    alt={p.name}
                    loading="lazy"
                    width={800}
                    height={1008}
                    className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                </div>
                <p className="mt-3 eyebrow text-muted-foreground">{categoryLabel(p.category)}</p>
                <p className="font-display text-xl">{p.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span>{brl(Number(p.price))}</span>
                  <span className="flex gap-1">
                    {colors.map((hex) => (
                      <span
                        key={hex}
                        className="h-3 w-3 rounded-full border"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
