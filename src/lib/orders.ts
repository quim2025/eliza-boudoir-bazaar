export const ORDER_STATUSES = [
  "pendente",
  "pago",
  "separando",
  "enviado",
  "entregue",
  "cancelado",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  pendente: "Aguardando pagamento",
  pago: "Pago",
  separando: "Em separação",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const PAYMENT_LABEL: Record<string, string> = {
  aprovado_teste: "Aprovado (teste)",
  pendente: "Pendente",
  recusado_teste: "Recusado (teste)",
  aprovado_mp: "Aprovado (Mercado Pago)",
  recusado_mp: "Recusado (Mercado Pago)",
  cancelado_mp: "Cancelado (Mercado Pago)",
};

export const dateBR = (d: string) =>
  new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export interface OrderNotificationEmailParams {
  orderId: string;
  customerName: string;
  status: string;
  trackingCode?: string;
  items: Array<{
    product_name: string;
    size: string;
    color: string;
    quantity: number;
    unit_price?: number;
  }>;
  total?: number;
  shippingAddress?: Record<string, string>;
}

export function generateOrderNotificationEmail(params: OrderNotificationEmailParams): {
  subject: string;
  body: string;
  whatsappMessage: string;
} {
  const code = params.orderId.slice(0, 8).toUpperCase();
  const statusLabel = STATUS_LABEL[params.status] ?? params.status;
  const tracking = params.trackingCode?.trim();

  const itemsList = params.items
    .map(
      (i) =>
        `• ${i.quantity}x ${i.product_name} (Tamanho: ${i.size}, Cor: ${i.color})${
          i.unit_price
            ? ` — R$ ${(Number(i.unit_price) * i.quantity).toFixed(2).replace(".", ",")}`
            : ""
        }`,
    )
    .join("\n");

  const trackingText = tracking
    ? `Código de rastreio: ${tracking}\nAcompanhe seu envio pelo rastreamento:\nhttps://rastreamento.correios.com.br/app/index.php?codigo=${tracking}`
    : `Código de rastreio: (O código será fornecido assim que a encomenda for despachada com a transportadora.)`;

  const addressText = params.shippingAddress?.street
    ? `Endereço de entrega:\n${params.shippingAddress.street}, ${params.shippingAddress.number || "S/N"}${
        params.shippingAddress.complement ? ` - ${params.shippingAddress.complement}` : ""
      }\n${params.shippingAddress.neighborhood || ""}, ${params.shippingAddress.city || ""}/${
        params.shippingAddress.state || ""
      } - CEP: ${params.shippingAddress.cep || ""}`
    : "";

  const subject = `Atualização do seu pedido #${code} — Eliza Lingerie`;

  const body = `Olá, ${params.customerName}! É um prazer falar com você.

Temos novidades sobre a sua compra na Eliza Lingerie!

Status atualizado do seu pedido #${code}:
⭐ ${statusLabel.toUpperCase()} ⭐

${trackingText}

Produtos comprados:
${itemsList}
${params.total ? `\nValor total: R$ ${Number(params.total).toFixed(2).replace(".", ",")}` : ""}

${addressText ? `${addressText}\n` : ""}
Se tiver qualquer dúvida sobre sua entrega ou sobre as peças, nossa equipe está sempre à sua disposição.

Com carinho,
Equipe Eliza Lingerie
Delicadeza e conforto que abraçam você.`;

  const whatsappMessage = encodeURIComponent(body);

  return { subject, body, whatsappMessage };
}
