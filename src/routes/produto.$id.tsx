import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, categoryLabel, productImage, getMockProduct } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/produto/$id")({
  head: () => ({
    meta: [
      { title: "Produto — Eliza Lingerie" },
      { name: "description", content: "Escolha tamanho e cor e adicione ao carrinho." },
      { property: "og:title", content: "Produto — Eliza Lingerie" },
      { property: "og:description", content: "Escolha tamanho e cor e adicione ao carrinho." },
    ],
  }),
  component: Produto,
});

function Produto() {
  const { id } = Route.useParams();
  const cart = useCart();
  const navigate = useNavigate();
  const [size, setSize] = useState<string>();
  const [color, setColor] = useState<string>();
  const [qty, setQty] = useState(1);

  const { data: p, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*, product_variants(*)")
          .eq("id", id)
          .maybeSingle();
        if (error || !data) return getMockProduct(id) ?? null;
        return data;
      } catch (err) {
        console.warn("Usando produto demonstrativo:", err);
        return getMockProduct(id) ?? null;
      }
    },
  });

  if (isLoading)
    return <p className="mx-auto max-w-7xl px-6 py-12 text-muted-foreground">Carregando…</p>;
  if (!p) return <p className="mx-auto max-w-7xl px-6 py-12">Produto não encontrado.</p>;

  const variants = p.product_variants;
  const sizes = Array.from(new Set(variants.map((v) => v.size)));
  const colors = Array.from(new Map(variants.map((v) => [v.color, v.color_hex])).entries());
  const selected = variants.find((v) => v.size === size && v.color === color);
  const stockFor = (s: string, c?: string) =>
    variants.filter((v) => v.size === s && (!c || v.color === c)).reduce((t, v) => t + v.stock, 0);

  const addToCart = (goToCart: boolean) => {
    if (!selected) return toast.error("Escolha tamanho e cor");
    if (selected.stock < qty) return toast.error("Quantidade indisponível em estoque");
    cart.add({
      variantId: selected.id,
      productId: p.id,
      name: p.name,
      size: selected.size,
      color: selected.color,
      price: Number(p.price),
      imageKey: p.image_key,
      quantity: qty,
    });
    toast.success("Adicionado ao carrinho");
    if (goToCart) navigate({ to: "/carrinho" });
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-12 px-6 py-12 md:grid-cols-2">
      <img
        src={productImage(p.image_key)}
        alt={p.name}
        width={800}
        height={1008}
        className="aspect-[4/5] w-full bg-muted object-cover"
      />
      <div>
        <Link
          to="/loja"
          search={{ categoria: p.category }}
          className="eyebrow text-muted-foreground hover:text-primary"
        >
          {categoryLabel(p.category)}
        </Link>
        <h1 className="mt-2 text-5xl">{p.name}</h1>
        <p className="mt-4 text-2xl">{brl(Number(p.price))}</p>
        <p className="text-sm text-muted-foreground">
          ou 6x de {brl(Number(p.price) / 6)} sem juros
        </p>
        <p className="mt-6 leading-relaxed text-muted-foreground">{p.description}</p>

        <div className="mt-8">
          <p className="eyebrow mb-3">
            Cor {color && <span className="text-muted-foreground">— {color}</span>}
          </p>
          <div className="flex gap-3">
            {colors.map(([name, hex]) => (
              <button
                key={name}
                title={name}
                onClick={() => setColor(name)}
                className={`h-9 w-9 rounded-full border-2 ring-offset-2 ring-offset-background transition ${color === name ? "ring-2 ring-primary" : ""}`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="eyebrow mb-3">Tamanho</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const out = stockFor(s, color) === 0;
              return (
                <button
                  key={s}
                  disabled={out}
                  onClick={() => setSize(s)}
                  className={`h-11 min-w-11 border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-30 disabled:line-through ${size === s ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {selected && (
            <p
              className={`mt-3 text-sm ${selected.stock <= 3 ? "text-destructive" : "text-muted-foreground"}`}
            >
              {selected.stock === 0
                ? "Esgotado"
                : selected.stock <= 3
                  ? `Últimas ${selected.stock} unidades`
                  : "Em estoque"}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center border">
            <button className="px-4 py-2" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="w-8 text-center">{qty}</span>
            <button className="px-4 py-2" onClick={() => setQty((q) => q + 1)}>
              +
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="rounded-none eyebrow flex-1" onClick={() => addToCart(true)}>
            Comprar agora
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-none eyebrow flex-1"
            onClick={() => addToCart(false)}
          >
            Adicionar ao carrinho
          </Button>
        </div>
      </div>
    </div>
  );
}
