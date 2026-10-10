import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SHIPPING_FEE } from "@/lib/catalog";

// CEP de origem (de onde a loja envia). Padrão São Paulo/SP.
const FROM_CEP = process.env["MELHOR_ENVIO_FROM_CEP"] || "01310100";

// Token padrão de sandbox do Melhor Envio (ativo até 2027)
const DEFAULT_SANDBOX_TOKEN =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NTYiLCJqdGkiOiI3NGM5NWIwNjg4OTZlNTA0NWRmNDM2NGEzZjBmYjhlMzcxMzExZjlhZDY1NmRlMjdjZTczZWYxNDQxYWVmYTQ2ODEyN2U1NTA4NmJjNWJjMSIsImlhdCI6MTc5MTU2MzAyMi4zMDExNDIsIm5iZiI6MTc5MTU2MzAyMi4zMDExNDUsImV4cCI6MTgyMzA5OTAyMi4yODQ3ODcsInN1YiI6ImEyZjExMjgyLWI2ODItNDc1NC05ZTZiLTI3YjNjZjNkMjY4ZCIsInNjb3BlcyI6WyJjYXJ0LXJlYWQiLCJjYXJ0LXdyaXRlIiwiY29tcGFuaWVzLXJlYWQiLCJjb21wYW5pZXMtd3JpdGUiLCJjb3Vwb25zLXJlYWQiLCJjb3Vwb25zLXdyaXRlIiwibm90aWZpY2F0aW9ucy1yZWFkIiwib3JkZXJzLXJlYWQiLCJwcm9kdWN0cy1yZWFkIiwicHJvZHVjdHMtZGVzdHJveSIsInByb2R1Y3RzLXdyaXRlIiwicHVyY2hhc2VzLXJlYWQiLCJzaGlwcGluZy1jYWxjdWxhdGUiLCJzaGlwcGluZy1jYW5jZWwiLCJzaGlwcGluZy1jaGVja291dCIsInNoaXBwaW5nLWNvbXBhbmllcyIsInNoaXBwaW5nLWdlbmVyYXRlIiwic2hpcHBpbmctcHJldmlldyIsInNoaXBwaW5nLXByaW50Iiwic2hpcHBpbmctc2hhcmUiLCJzaGlwcGluZy10cmFja2luZyIsImVjb21tZXJjZS1zaGlwcGluZyIsInRyYW5zYWN0aW9ucy1yZWFkIiwidXNlcnMtcmVhZCIsInVzZXJzLXdyaXRlIiwid2ViaG9va3MtcmVhZCIsIndlYmhvb2tzLXdyaXRlIiwid2ViaG9va3MtZGVsZXRlIiwidGRlYWxlci13ZWJob29rIl19.U-PQndsJzwfUtkJ0EuKa0JNE0xFGH_zF8TJvq9ReVbhNTEZnfAwY23zQrWvdpGosc_GGyVLXnW-kli0MS5KvCrysbttlZB8WDIsAKkhBRzaL4eoAaL26sENQ4HbCitibh0JSvhveyj-HBtu15v-YLavXqbC0Eq2wv2hnHITFIF_KqciyKu24y5zVLXf_wBBCDw-3N9gsScwUyk_5fNxUmFEFH2OtYHkVEOWTFaXW0CDVN91Ld99WoTKUoWOiw_hg1ssZNZitL1lGApQq8k6TzM2Tx9kupWJ_lSbw5j67SC82XZ2zXz6_girPhSABju6LCTy1pql9F0RNRcaGuxAO__4qaD8UUTMNlX5uhItemDCfR093qDiVTA0_zAPvxU2JyAZjAdBOFyuR6Z2AFxizw_L8VVf_ouu-w1fuDlTDpRwkhl2LnkMlK-c6QTA8tKctTgcYmlEym2c0oG6dMs-loo8CWxGzoR8NMTZvmJ4eP3znAysMO3bAPwzApCYGYIJrECHN5u6Vl9Q6KbNeR7ehNds6RbA87tKwM8wLTcE2-Jr2KEpFSGGECLz917FDatLXTPABhfN8kOF9YeaBNgN1yMmcmioFkXvKhBETPLtn0AzucYQAzurnIJIGdyIEUJJne51SqBgEOL5Cs15snPszCkMC9LMrGp8YCgsp10uPEfA";

export type ShippingOption = {
  id: string;
  name: string;
  company: string;
  price: number;
  days: number;
  picture?: string;
};

/** Cotação de frete — Melhor Envio (sandbox otimizado para peças de lingerie). */
export const quoteShipping = createServerFn({ method: "POST" })
  .inputValidator((d: { toCep: string; items: { id: string; quantity: number; price: number }[] }) => {
    const cep = String(d.toCep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) throw new Error("CEP inválido");
    return { toCep: cep, items: (d.items ?? []).slice(0, 50) };
  })
  .handler(async ({ data }): Promise<{ options: ShippingOption[]; live: boolean }> => {
    const token = process.env["MELHOR_ENVIO_TOKEN"] || DEFAULT_SANDBOX_TOKEN;

    // Dimensões realistas de pacote de lingerie para habilitar Mini Envios, PAC, SEDEX e Jadlog
    const totalQty = data.items.reduce((acc, i) => acc + (i.quantity || 1), 0);
    const totalInsurance = data.items.reduce((acc, i) => acc + (i.price * (i.quantity || 1)), 0);

    // Mini Envios aceita até 0.3kg, altura max 4cm, largura max 16cm, comprimento max 24cm
    const isSmallPackage = totalQty <= 2;
    const height = isSmallPackage ? 3 : Math.min(25, Math.max(4, totalQty * 2.5));
    const width = isSmallPackage ? 15 : Math.min(25, 18);
    const length = isSmallPackage ? 20 : Math.min(30, 22);
    const weight = Math.min(5, Math.max(0.1, totalQty * 0.1));

    try {
      const res = await fetch("https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "Eliza Lingerie (contato@elizalingerie.com.br)",
        },
        body: JSON.stringify({
          from: { postal_code: FROM_CEP },
          to: { postal_code: data.toCep },
          products: [
            {
              id: "pacote-lingerie",
              width,
              height,
              length,
              weight,
              insurance_value: Math.max(20, totalInsurance),
              quantity: 1,
            },
          ],
        }),
      });

      if (!res.ok) {
        console.warn("Melhor Envio Sandbox retornou status:", res.status);
        return {
          live: false,
          options: [
            { id: "sedex-sim", name: "SEDEX", company: "Correios", price: 29.9, days: 2 },
            { id: "pac-sim", name: "PAC", company: "Correios", price: 19.9, days: 6 },
          ],
        };
      }

      const list = (await res.json()) as any[];
      const validOptions: ShippingOption[] = list
        .filter((o) => !o.error && (o.custom_price || o.price))
        .map((o) => ({
          id: String(o.id),
          name: o.name,
          company: o.company?.name ?? "Transportadora",
          price: Number(o.custom_price ?? o.price),
          days: Number(o.custom_delivery_time ?? o.delivery_time),
          picture: o.company?.picture,
        }))
        .sort((a, b) => a.price - b.price);

      if (validOptions.length > 0) {
        return { live: true, options: validOptions };
      }
    } catch (err) {
      console.error("Erro na consulta Melhor Envio:", err);
    }

    // Fallback amigável caso a API sandbox oscile
    return {
      live: false,
      options: [
        { id: "correios-pac", name: "PAC", company: "Correios", price: 19.9, days: 6 },
        { id: "correios-sedex", name: "SEDEX", company: "Correios", price: 29.9, days: 2 },
      ],
    };
  });

/** Cria sessão oficial do Stripe Checkout (modo teste) para um pedido do usuário. */
export const createStripeCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; origin: string }) => d)
  .handler(async ({ data, context }) => {
    const stripeKey =
      process.env["STRIPE_SECRET_KEY"] ||
      process.env["VITE_STRIPE_SECRET_KEY"];

    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", data.orderId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error || !order) throw new Error("Pedido não encontrado");

    const origin = new URL(data.origin).origin;

    if (!stripeKey) {
      console.warn("STRIPE_SECRET_KEY não configurada no ambiente.");
      return {
        url: `${origin}/conta?status=stripe_config_necessaria&orderId=${order.id}`,
        sessionId: "mock_stripe_" + order.id,
        mock: true,
      };
    }

    // Monta parâmetros no padrão form-urlencoded da API REST moderna da Stripe
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("currency", "brl");
    params.append("client_reference_id", order.id);
    params.append("metadata[order_id]", order.id);
    params.append("metadata[user_id]", context.userId);
    params.append("success_url", `${origin}/conta?status=sucesso&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${origin}/checkout?status=cancelado`);

    let itemIdx = 0;
    for (const item of order.order_items || []) {
      const unitAmount = Math.round(Number(item.unit_price) * 100);
      params.append(`line_items[${itemIdx}][price_data][currency]`, "brl");
      params.append(`line_items[${itemIdx}][price_data][unit_amount]`, String(unitAmount));
      params.append(
        `line_items[${itemIdx}][price_data][product_data][name]`,
        `${item.product_name} (${item.size}, ${item.color})`
      );
      params.append(`line_items[${itemIdx}][quantity]`, String(item.quantity));
      itemIdx++;
    }

    if (Number(order.shipping) > 0) {
      const shippingAmount = Math.round(Number(order.shipping) * 100);
      params.append(`line_items[${itemIdx}][price_data][currency]`, "brl");
      params.append(`line_items[${itemIdx}][price_data][unit_amount]`, String(shippingAmount));
      params.append(
        `line_items[${itemIdx}][price_data][product_data][name]`,
        `Frete (${order.shipping_service || "Entrega"})`
      );
      params.append(`line_items[${itemIdx}][quantity]`, "1");
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Stripe Checkout Error:", res.status, errText);
      throw new Error("Não foi possível criar a sessão de pagamento no Stripe.");
    }

    const session = (await res.json()) as { id: string; url: string };
    return { url: session.url, sessionId: session.id, mock: false };
  });

/** Legado / Compatibilidade: Mantém Mercado Pago caso o usuário deseje alternar */
export const createMercadoPagoPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; origin: string }) => d)
  .handler(async ({ data, context }) => {
    const token = process.env["MERCADOPAGO_ACCESS_TOKEN"];
    if (!token) throw new Error("Mercado Pago ainda não configurado");
    const { data: order, error } = await context.supabase
      .from("orders").select("*, order_items(*)").eq("id", data.orderId).eq("user_id", context.userId).maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");
    const origin = new URL(data.origin).origin;

    const items = order.order_items.map((i) => ({
      id: i.variant_id ?? i.id,
      title: `${i.product_name} (${i.size}, ${i.color})`,
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
      currency_id: "BRL",
    }));
    if (Number(order.shipping) > 0) items.push({ id: "frete", title: "Frete", quantity: 1, unit_price: Number(order.shipping), currency_id: "BRL" });

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        items,
        external_reference: order.id,
        back_urls: { success: `${origin}/conta`, pending: `${origin}/conta`, failure: `${origin}/conta` },
        auto_return: origin.startsWith("https") ? "approved" : undefined,
        notification_url: origin.startsWith("https") ? `${origin}/api/public/mercadopago-webhook` : undefined,
        statement_descriptor: "ELIZA LINGERIE",
      }),
    });
    if (!res.ok) {
      console.error("Mercado Pago", res.status, await res.text());
      throw new Error("Não foi possível iniciar o pagamento");
    }
    const pref = (await res.json()) as { id: string; init_point: string; sandbox_init_point: string };
    return { url: pref.sandbox_init_point || pref.init_point, preferenceId: pref.id };
  });
