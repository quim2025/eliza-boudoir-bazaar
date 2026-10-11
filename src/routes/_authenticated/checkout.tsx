import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  quoteShipping,
  createStripeCheckoutSession,
  createMercadoPagoPreference,
  type ShippingOption,
} from "@/lib/integrations.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { brl, FREE_SHIPPING_FROM, SHIPPING_FEE } from "@/lib/catalog";
import { activeProvider, type PaymentResult, type PaymentMethod } from "@/lib/payments";
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

type Method = "stripe" | "cartao" | "pix" | "boleto" | "mercadopago";
const METHOD_LABEL: Record<Method, string> = {
  stripe: "Stripe Checkout",
  cartao: "Cartão de Crédito",
  pix: "PIX (teste)",
  boleto: "Boleto (teste)",
  mercadopago: "Mercado Pago",
};

function Checkout() {
  const { user } = Route.useRouteContext();
  const cart = useCart();
  const quote = useServerFn(quoteShipping);
  const stripeSession = useServerFn(createStripeCheckoutSession);
  const mpPref = useServerFn(createMercadoPagoPreference);
  const [addr, setAddr] = useState<Address>(emptyAddress);
  const [recipient, setRecipient] = useState({ name: "", phone: "" });
  const [method, setMethod] = useState<Method>("cartao");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "", installments: 1 });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<(PaymentResult & { orderId?: string }) | null>(null);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [shipSel, setShipSel] = useState<ShippingOption | null>(null);
  const [quoting, setQuoting] = useState(false);

  const fillStripeTestCard = (type: "approved" | "declined" = "approved") => {
    if (type === "declined") {
      setCard({
        number: "4000 0000 0000 0002",
        name: "Teste Recusa Stripe",
        expiry: "12/28",
        cvv: "123",
        installments: 1,
      });
      toast.info("Cartão de recusa preenchido (Stripe test: 4000...0002)");
    } else {
      setCard({
        number: "4242 4242 4242 4242",
        name: user.email?.split("@")[0]?.toUpperCase() || "CLIENTE ELIZA",
        expiry: "12/28",
        cvv: "123",
        installments: 1,
      });
      toast.success("Cartão de teste Stripe preenchido (4242 4242 4242 4242)");
    }
  };

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });
  useEffect(() => {
    if (profile) {
      setAddr({
        cep: profile.cep ?? "",
        street: profile.street ?? "",
        number: profile.number ?? "",
        complement: profile.complement ?? "",
        neighborhood: profile.neighborhood ?? "",
        city: profile.city ?? "",
        state: profile.state ?? "",
        delivery_notes: profile.delivery_notes ?? "",
      });
      setRecipient({ name: profile.full_name || "", phone: profile.phone ?? "" });
    }
  }, [profile]);

  const cepDigits = addr.cep.replace(/\D/g, "");
  const itemsKey = cart.items.map((i) => `${i.variantId}:${i.quantity}`).join(",");
  useEffect(() => {
    if (cepDigits.length !== 8 || !cart.items.length) return;
    setQuoting(true);
    quote({
      data: {
        toCep: cepDigits,
        items: cart.items.map((i) => ({ id: i.variantId, quantity: i.quantity, price: i.price })),
      },
    })
      .then((r) => {
        setOptions(r.options);
        setShipSel(r.options[0] ?? null);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao calcular frete"))
      .finally(() => setQuoting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepDigits, itemsKey]);

  const freeShipping = cart.subtotal >= FREE_SHIPPING_FROM;
  const shipping = freeShipping ? 0 : (shipSel?.price ?? SHIPPING_FEE);
  const total = cart.subtotal + shipping;

  if (result)
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="eyebrow text-muted-foreground">Ambiente de testes (Stripe Sandbox)</p>
        <h1 className="mt-2 text-5xl">
          {result.status === "recusado_teste" ? "Pagamento não aprovado" : "Pedido confirmado!"}
        </h1>
        <p className="mt-4 text-muted-foreground">{result.message}</p>
        {result.pixCode && (
          <p className="mt-6 break-all border bg-card p-4 text-xs font-mono">{result.pixCode}</p>
        )}
        {result.boletoLine && (
          <p className="mt-6 border bg-card p-4 text-sm font-mono">{result.boletoLine}</p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Código de Referência: {result.reference}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          {result.status === "recusado_teste" ? (
            <Button className="rounded-none eyebrow" onClick={() => setResult(null)}>
              Tentar novamente
            </Button>
          ) : (
            <Button asChild className="rounded-none eyebrow">
              <Link to="/conta">Ver meus pedidos</Link>
            </Button>
          )}
        </div>
      </div>
    );

  if (!cart.items.length)
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-4xl">Seu carrinho está vazio</h1>
        <Button asChild className="mt-6 rounded-none eyebrow">
          <Link to="/loja">Ir para a loja</Link>
        </Button>
      </div>
    );

  const placeOrder = async (status: string, reference: string, m: string) => {
    const { data, error } = await supabase.rpc("place_order_v2", {
      p_items: cart.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
      p_shipping_address: { ...addr, recipient: recipient.name, phone: recipient.phone },
      p_payment_method: m,
      p_payment_status: status,
      p_payment_reference: reference,
      p_shipping: shipping,
      p_shipping_service: freeShipping
        ? "Frete grátis"
        : shipSel
          ? `${shipSel.company} ${shipSel.name}`
          : "Padrão",
    });
    if (error) throw error;
    return data as string;
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeShipping && !shipSel)
      return toast.error("Informe um CEP válido para calcular o frete");
    setProcessing(true);
    try {
      if (method === "stripe") {
        const orderId = await placeOrder("pendente", "", "stripe");
        const { url, mock } = await stripeSession({
          data: { orderId, origin: window.location.origin },
        });
        cart.clear();
        if (mock) {
          toast.info("Modo de teste Stripe ativado. Redirecionando para seu pedido...");
        }
        window.location.href = url;
        return;
      }

      if (method === "mercadopago") {
        const orderId = await placeOrder("pendente", "", "mercadopago");
        cart.clear();
        const { url } = await mpPref({ data: { orderId, origin: window.location.origin } });
        window.location.href = url;
        return;
      }

      const res = await activeProvider.charge({
        amount: total,
        method: method as PaymentMethod,
        card: method === "cartao" ? card : undefined,
      });

      if (res.status === "recusado_teste") {
        setResult(res);
        return;
      }
      const orderId = await placeOrder(res.status, res.reference, method);
      cart.clear();
      setResult({ ...res, orderId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao finalizar pedido");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form
      onSubmit={pay}
      className="mx-auto grid max-w-6xl gap-12 px-6 py-12 lg:grid-cols-[1fr_380px]"
    >
      <div className="space-y-10">
        <h1 className="text-5xl">Finalizar compra</h1>
        <section className="space-y-4">
          <h2 className="text-2xl">Entrega</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Destinatário</Label>
              <Input
                required
                value={recipient.name}
                onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                placeholder="Nome de quem vai receber"
              />
            </div>
            <div>
              <Label>Telefone de Contato</Label>
              <Input
                required
                value={recipient.phone}
                onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                placeholder="(11) 98765-4321"
              />
            </div>
          </div>
          <AddressFields value={addr} onChange={setAddr} />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Opções de Frete (Melhor Envio Sandbox)</p>
              {options.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {options.length} transportadoras disponíveis
                </span>
              )}
            </div>

            {freeShipping ? (
              <div className="border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300">
                ✨ <strong>Parabéns!</strong> Você ganhou frete grátis nesta compra (pedido acima de
                R$ 299).
              </div>
            ) : quoting ? (
              <p className="text-sm text-muted-foreground animate-pulse">
                Calculando cotações no Melhor Envio…
              </p>
            ) : !options.length ? (
              <p className="text-sm text-muted-foreground">
                Informe o CEP acima para cotar transportadoras em tempo real.
              </p>
            ) : (
              <div className="grid gap-2">
                {options.map((o) => (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-center justify-between border p-3 text-sm transition hover:border-primary ${
                      shipSel?.id === o.id ? "border-primary bg-primary/5 font-medium" : "bg-card"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping_sel"
                        checked={shipSel?.id === o.id}
                        onChange={() => setShipSel(o)}
                        className="text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{o.company}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {o.name}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Previsão: até {o.days} dias úteis
                        </p>
                      </div>
                    </span>
                    <span className="text-base font-semibold">{brl(o.price)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl">Forma de Pagamento</h2>
            <span className="eyebrow rounded-full bg-accent px-3 py-1 text-accent-foreground text-xs">
              Stripe Test Mode
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["cartao", "stripe", "pix", "boleto"] as Method[]).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMethod(m)}
                className={`border py-3 text-sm transition ${
                  method === m
                    ? "border-primary bg-primary text-primary-foreground font-medium"
                    : "hover:border-primary bg-card"
                }`}
              >
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>

          {method === "stripe" && (
            <div className="border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Ambiente Teste Oficial
                </div>
                <h3 className="font-semibold text-base">Stripe Checkout Oficial</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Ao clicar no botão abaixo, você será redirecionada para a página oficial do{" "}
                <strong>Stripe Checkout</strong>, onde poderá pagar com cartão, Apple Pay, Google
                Pay ou outras carteiras no modo de teste.
              </p>
              <div className="rounded border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p>
                  💡 <strong>Cartão para testar na Stripe:</strong>{" "}
                  <code className="font-mono font-bold text-foreground">4242 4242 4242 4242</code>
                </p>
                <p>
                  Validade: qualquer data futura (ex: 12/28) · CVC: qualquer 3 dígitos (ex: 123)
                </p>
              </div>
              <Button
                type="submit"
                disabled={processing}
                className="w-full bg-[#635BFF] hover:bg-[#5349e0] text-white rounded-none py-6 text-base font-medium shadow-sm transition"
              >
                {processing
                  ? "Iniciando Stripe Checkout…"
                  : `➡️ Ir para o Stripe Checkout (${brl(total)})`}
              </Button>
            </div>
          )}

          {method === "cartao" && (
            <div className="grid grid-cols-4 gap-4 border bg-card p-5">
              <div className="col-span-4 flex items-center justify-between pb-1 border-b">
                <span className="text-xs font-medium text-muted-foreground">
                  Simulador de Cartão Stripe
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fillStripeTestCard("approved")}
                    className="text-xs text-primary underline hover:text-primary/80"
                  >
                    Usar Cartão Aprovado (4242)
                  </button>
                  <span className="text-xs text-muted-foreground">|</span>
                  <button
                    type="button"
                    onClick={() => fillStripeTestCard("declined")}
                    className="text-xs text-destructive underline hover:text-destructive/80"
                  >
                    Testar Recusa (0002)
                  </button>
                </div>
              </div>

              <div className="col-span-4">
                <Label>Número do cartão</Label>
                <Input
                  required
                  value={card.number}
                  onChange={(e) => setCard({ ...card, number: e.target.value })}
                  placeholder="4242 4242 4242 4242"
                />
              </div>
              <div className="col-span-4">
                <Label>Nome impresso no cartão</Label>
                <Input
                  required
                  value={card.name}
                  onChange={(e) => setCard({ ...card, name: e.target.value })}
                  placeholder="NOME COMPLETO"
                />
              </div>
              <div className="col-span-2">
                <Label>Validade</Label>
                <Input
                  required
                  value={card.expiry}
                  onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                  placeholder="MM/AA"
                />
              </div>
              <div className="col-span-2">
                <Label>CVV</Label>
                <Input
                  required
                  value={card.cvv}
                  onChange={(e) => setCard({ ...card, cvv: e.target.value })}
                  placeholder="123"
                />
              </div>
              <div className="col-span-4">
                <Label>Parcelas</Label>
                <select
                  className="mt-1 h-9 w-full border bg-background px-3 text-sm"
                  value={card.installments}
                  onChange={(e) => setCard({ ...card, installments: Number(e.target.value) })}
                >
                  {Array.from({ length: activeProvider.maxInstallments }, (_, i) => i + 1).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n}x de {brl(total / n)} sem juros
                      </option>
                    ),
                  )}
                </select>
              </div>
              <p className="col-span-4 text-xs text-muted-foreground">
                Regras Stripe: Cartão 4242 é aprovado; cartões terminados em 0002 são recusados.
              </p>
            </div>
          )}

          {method === "pix" && (
            <div className="border bg-card p-5 space-y-2">
              <h3 className="font-medium text-sm">PIX Instantâneo (Ambiente de Testes)</h3>
              <p className="text-sm text-muted-foreground">
                Um código PIX de teste (Copia e Cola) será gerado e aprovado para simular o
                recebimento instantâneo.
              </p>
            </div>
          )}

          {method === "boleto" && (
            <div className="border bg-card p-5 space-y-2">
              <h3 className="font-medium text-sm">Boleto Bancário (Ambiente de Testes)</h3>
              <p className="text-sm text-muted-foreground">
                Uma linha digitável de teste será gerada e o pedido ficará com status
                &quot;aguardando pagamento&quot;.
              </p>
            </div>
          )}
        </section>
      </div>

      <aside className="h-fit space-y-4 border bg-card p-6 lg:sticky lg:top-28">
        <h2 className="text-2xl">Seu pedido</h2>
        <ul className="space-y-2 text-sm">
          {cart.items.map((i) => (
            <li key={i.variantId} className="flex justify-between gap-2">
              <span>
                {i.quantity}× {i.name}{" "}
                <span className="text-muted-foreground">
                  ({i.size}, {i.color})
                </span>
              </span>
              <span>{brl(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{brl(cart.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Frete ({shipSel?.company || "Entrega"})</span>
            <span>{shipping ? brl(shipping) : "Grátis"}</span>
          </div>
          <div className="flex justify-between pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{brl(total)}</span>
          </div>
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={processing}
          className="w-full rounded-none eyebrow"
        >
          {processing
            ? "Processando…"
            : method === "stripe"
              ? `Ir para Stripe Checkout (${brl(total)})`
              : method === "cartao"
                ? `Pagar com Cartão (${brl(total)})`
                : `Pagar ${brl(total)}`}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {method === "stripe" ? "Stripe Checkout (Teste)" : activeProvider.label} — nenhuma
          cobrança real
        </p>
      </aside>
    </form>
  );
}
export default Checkout;
