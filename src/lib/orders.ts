export const ORDER_STATUSES = ["pendente", "pago", "separando", "enviado", "entregue", "cancelado"] as const;

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

export const dateBR = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
