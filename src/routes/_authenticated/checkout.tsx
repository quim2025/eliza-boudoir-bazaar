import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { brl, FREE_SHIPPING_FROM, SHIPPING_FEE } from "@/lib/catalog";
import { activeProvider, type PaymentMethod, type PaymentResult } from "@/lib/payments";
import { AddressFields, emptyAddress, type Address } from "@/components/AddressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [
      { title: "Pagamento — Eliza Lingerie" },
      { name: "description", content: "Finalize sua compra com segurança." },
      { property: "og:title", content: "Pagamento — Eliza Lingerie" },
      { property: "og:description", content: "Finalize sua compra com segurança." },
    ],
  }),
  component: Checkout,
});

const METHOD_LABEL: Record<PaymentMethod, string> = { cartao: "Cartão de crédito", pix: "PIX", boleto: "Boleto" };

function Checkout() {
  const { user } = Route.useRouteContext();
  const cart = useCart();
  const navigate = useNavigate();
  const [addr, setAddr] = useState<Address>(emptyAddress);
  const [recipient, setRecipient] = useState({ name: "", phone: "" });
  const [method, setMethod] = useState<PaymentMethod>("cartao");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "", installments: 1 });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<(PaymentResult & { orderId?: string }) | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });
  useEffect(() => {
    if (profile) {
      setAddr({ cep: profile.cep ?? "", street: profile.street ?? "", number: profile.number ?? "", complement: profile.complement ?? "", neighborhood: profile.neighborhood ?? "", city: profile.city ?? "", state: profile.state ?? "", delivery_notes: profile.delivery_notes ?? "" });
      setRecipient({ name: profile.full_name, phone: profile.phone ?? "" });
    }
  }, [profile]);

  const shipping = cart.subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  const total = cart.subtotal + shipping;

  if (result)
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="eyebrow text-muted-foreground">Ambiente de testes</p>
        <h1 className="mt-2 text-5xl">{result.status === "recusado_teste" ? "Pagamento recusado" : "Pedido recebido!"}</h1>
        <p className="mt-4 text-muted-foreground">{result.message}</p>
        {result.pixCode && <p className="mt-6 break-all border bg-card p-4 text-xs">{result.pixCode}</p>}
        {result.boletoLine && <p className="mt-6 border bg-card p-4 text-sm">{result.boletoLine}</p>}
        <p className="mt-4 text-sm">Referência: {result.reference}</p>
        <div className="mt-8 flex justify-center gap-3">
          {result.status === "recusado_teste" ? (
            <Button className="rounded-none eyebrow" onClick={() => setResult(null)}>Tentar novamente</Button>
          ) : (
            <Button asChild className="rounded-none eyebrow"><Link to="/conta">Ver meus pedidos</Link></Button>
          )}
        </div>
      </div>
    );

  if (!cart.items.length)
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-4xl">Seu carrinho está vazio</h1>
        <Button asChild className="mt-6 rounded-none eyebrow"><Link to="/loja">Ir para a loja</Link></Button>
      </div>
    );

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const res = await activeProvider.charge({ amount: total, method, card: method === "cartao" ? card : undefined });
      if (res.status === "recusado_teste") {
        setResult(res);
        return;
      }
      const { data: orderId, error } = await supabase.rpc("place_order", {
        p_items: cart.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
        p_shipping_address: { ...addr, recipient: recipient.name, phone: recipient.phone },
        p_payment_method: method,
        p_payment_status: res.status,
        p_payment_reference: res.reference,
      });
      if (error) throw error;
      cart.clear();
      setResult({ ...res, orderId: orderId as string });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao finalizar pedido");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={pay} className="mx-auto grid max-w-6xl gap-12 px-6 py-12 lg:grid-cols-[1fr_380px]">
      <div className="space-y-10">
        <h1 className="text-5xl">Finalizar compra</h1>
        <section className="space-y-4">
          <h2 className="text-2xl">Entrega</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Destinatário</Label><Input required value={recipient.name} onChange={(e) => setRecipient({ ...recipient, name: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input required value={recipient.phone} onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })} /></div>
          </div>
          <AddressFields value={addr} onChange={setAddr} />
        </section>

        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl">Pagamento</h2>
            <span className="eyebrow rounded-full bg-accent px-3 py-1 text-accent-foreground">Modo teste</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {activeProvider.methods.map((m) => (
              <button type="button" key={m} onClick={() => setMethod(m)}
                className={`border py-3 text-sm transition ${method === m ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"}`}>
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>
          {method === "cartao" && (
            <div className="grid grid-cols-4 gap-4 border bg-card p-5">
              <div className="col-span-4"><Label>Número do cartão</Label><Input required value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} placeholder="4242 4242 4242 4242" /></div>
              <div className="col-span-4"><Label>Nome impresso</Label><Input required value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} /></div>
              <div className="col-span-2"><Label>Validade</Label><Input required value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} placeholder="MM/AA" /></div>
              <div className="col-span-2"><Label>CVV</Label><Input required value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value })} placeholder="123" /></div>
              <div className="col-span-4">
                <Label>Parcelas</Label>
                <select className="mt-1 h-9 w-full border bg-background px-3 text-sm" value={card.installments} onChange={(e) => setCard({ ...card, installments: Number(e.target.value) })}>
                  {Array.from({ length: activeProvider.maxInstallments }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}x de {brl(total / n)} sem juros</option>
                  ))}
                </select>
              </div>
              <p className="col-span-4 text-xs text-muted-foreground">Teste: qualquer cartão é aprovado; cartões terminados em 0002 são recusados.</p>
            </div>
          )}
          {method === "pix" && <p className="border bg-card p-5 text-sm text-muted-foreground">Um código PIX de teste será gerado e aprovado automaticamente.</p>}
          {method === "boleto" && <p className="border bg-card p-5 text-sm text-muted-foreground">Um boleto de teste será gerado e o pedido ficará aguardando pagamento.</p>}
        </section>
      </div>

      <aside className="h-fit space-y-4 border bg-card p-6 lg:sticky lg:top-28">
        <h2 className="text-2xl">Seu pedido</h2>
        <ul className="space-y-2 text-sm">
          {cart.items.map((i) => (
            <li key={i.variantId} className="flex justify-between gap-2">
              <span>{i.quantity}× {i.name} <span className="text-muted-foreground">({i.size}, {i.color})</span></span>
              <span>{brl(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{brl(cart.subtotal)}</span></div>
          <div className="flex justify-between"><span>Frete</span><span>{shipping ? brl(shipping) : "Grátis"}</span></div>
          <div className="flex justify-between pt-2 text-base"><span>Total</span><span>{brl(total)}</span></div>
        </div>
        <Button type="submit" size="lg" disabled={processing} className="w-full rounded-none eyebrow">
          {processing ? "Processando…" : `Pagar ${brl(total)}`}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{activeProvider.label} — nenhuma cobrança real</p>
      </aside>
    </form>
  );
}
