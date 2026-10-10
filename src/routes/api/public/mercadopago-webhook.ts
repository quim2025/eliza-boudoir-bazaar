import { createFileRoute } from "@tanstack/react-router";

// Recebe notificações do Mercado Pago. Não confiamos no corpo: buscamos o
// pagamento direto na API do Mercado Pago com nosso token antes de atualizar.
export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["MERCADOPAGO_ACCESS_TOKEN"];
        if (!token) return new Response("not configured", { status: 200 });
        const url = new URL(request.url);
        let body: any = {};
        try { body = await request.json(); } catch {}
        const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
        const paymentId = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
        if (type !== "payment" || !paymentId || !/^\d+$/.test(String(paymentId))) return new Response("ignored", { status: 200 });

        const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return new Response("lookup failed", { status: 200 });
        const p = (await r.json()) as { status: string; external_reference?: string; id: number };
        if (!p.external_reference) return new Response("ok", { status: 200 });

        const map: Record<string, { status: string; payment_status: string }> = {
          approved: { status: "pago", payment_status: "aprovado_mp" },
          rejected: { status: "cancelado", payment_status: "recusado_mp" },
          cancelled: { status: "cancelado", payment_status: "cancelado_mp" },
        };
        const next = map[p.status] ?? { status: "pendente", payment_status: `mp_${p.status}` };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("orders")
          .update({ ...next, payment_reference: `MP-${p.id}` })
          .eq("id", p.external_reference)
          .eq("payment_method", "mercadopago");
        return new Response("ok", { status: 200 });
      },
    },
  },
});
