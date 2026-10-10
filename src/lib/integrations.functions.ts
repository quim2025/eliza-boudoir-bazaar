import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SHIPPING_FEE } from "@/lib/catalog";

// CEP de origem (de onde a loja envia). Altere para o CEP real da loja.
const FROM_CEP = "01310100";

export type ShippingOption = { id: string; name: string; company: string; price: number; days: number };

/** Cotação de frete — Melhor Envio (sandbox). Sem token, retorna frete fixo. */
export const quoteShipping = createServerFn({ method: "POST" })
  .inputValidator((d: { toCep: string; items: { id: string; quantity: number; price: number }[] }) => {
    const cep = String(d.toCep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) throw new Error("CEP inválido");
    return { toCep: cep, items: (d.items ?? []).slice(0, 50) };
  })
  .handler(async ({ data }): Promise<{ options: ShippingOption[]; live: boolean }> => {
    const token = process.env["MELHOR_ENVIO_TOKEN"];
    if (!token) return { live: false, options: [{ id: "fixo", name: "Entrega padrão", company: "Eliza", price: SHIPPING_FEE, days: 7 }] };
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
        products: data.items.map((i) => ({ id: i.id, width: 20, height: 5, length: 25, weight: 0.2, insurance_value: i.price, quantity: i.quantity })),
      }),
    });
    if (!res.ok) {
      console.error("Melhor Envio", res.status, await res.text());
      throw new Error("Não foi possível calcular o frete agora");
    }
    const list = (await res.json()) as any[];
    const options = list
      .filter((o) => !o.error && o.price)
      .map((o) => ({ id: String(o.id), name: o.name, company: o.company?.name ?? "", price: Number(o.custom_price ?? o.price), days: Number(o.custom_delivery_time ?? o.delivery_time) }));
    return { live: true, options };
  });

/** Cria preferência do Mercado Pago Checkout Pro (sandbox) para um pedido do usuário. */
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
    await context.supabase.from("orders").select("id").eq("id", order.id); // RLS check only
    return { url: pref.sandbox_init_point || pref.init_point, preferenceId: pref.id };
  });
