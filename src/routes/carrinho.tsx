import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { brl, productImage, FREE_SHIPPING_FROM, SHIPPING_FEE } from "@/lib/catalog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Eliza Lingerie" },
      { name: "description", content: "Revise os itens do seu carrinho de compras." },
      { property: "og:title", content: "Carrinho — Eliza Lingerie" },
      { property: "og:description", content: "Revise os itens do seu carrinho de compras." },
    ],
  }),
  component: Carrinho,
});

function Carrinho() {
  const { items, setQty, remove, subtotal } = useCart();
  const shipping = subtotal >= FREE_SHIPPING_FROM || subtotal === 0 ? 0 : SHIPPING_FEE;

  if (!items.length)
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-4xl">Seu carrinho está vazio</h1>
        <Button asChild className="mt-8 rounded-none eyebrow">
          <Link to="/loja">Ir para a loja</Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:gap-12 px-4 sm:px-6 py-8 sm:py-12 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="text-3xl sm:text-5xl font-display">Carrinho</h1>
        <ul className="mt-6 sm:mt-8 divide-y border-y">
          {items.map((i) => (
            <li key={i.variantId} className="flex gap-3 sm:gap-4 py-4 sm:py-5">
              <img
                src={productImage(i.imageKey)}
                alt={i.name}
                loading="lazy"
                width={800}
                height={1008}
                className="h-24 sm:h-28 w-20 sm:w-24 bg-muted object-cover rounded-sm border shrink-0"
              />
              <div className="flex-1 min-w-0">
                <Link
                  to="/produto/$id"
                  params={{ id: i.productId }}
                  className="font-display text-lg sm:text-xl hover:text-primary leading-tight truncate block"
                >
                  {i.name}
                </Link>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Tamanho {i.size} · {i.color}
                </p>
                <div className="mt-3 flex items-center border w-fit bg-background">
                  <button
                    className="h-8 w-8 flex items-center justify-center hover:bg-muted font-medium text-base"
                    onClick={() => setQty(i.variantId, i.quantity - 1)}
                    aria-label="Diminuir quantidade"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-xs sm:text-sm font-medium">
                    {i.quantity}
                  </span>
                  <button
                    className="h-8 w-8 flex items-center justify-center hover:bg-muted font-medium text-base"
                    onClick={() => setQty(i.variantId, i.quantity + 1)}
                    aria-label="Aumentar quantidade"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-end justify-between">
                <span>{brl(i.price * i.quantity)}</span>
                <button
                  onClick={() => remove(i.variantId)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <aside className="h-fit bg-card p-6 border">
        <h2 className="text-2xl">Resumo</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{brl(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Frete</span>
            <span>{shipping ? brl(shipping) : "Grátis"}</span>
          </div>
          {shipping > 0 && (
            <p className="text-xs text-muted-foreground">
              Faltam {brl(FREE_SHIPPING_FROM - subtotal)} para frete grátis
            </p>
          )}
          <div className="flex justify-between border-t pt-3 text-base font-normal">
            <span>Total</span>
            <span>{brl(subtotal + shipping)}</span>
          </div>
        </div>
        <Button asChild size="lg" className="mt-6 w-full rounded-none eyebrow">
          <Link to="/checkout">Finalizar compra</Link>
        </Button>
      </aside>
    </div>
  );
}
