/**
 * Camada de pagamento plugável.
 * Hoje usa o provedor de TESTES (nenhum dinheiro real). Para trocar por um
 * provedor real (Stripe, Mercado Pago, Pagar.me...), implemente a interface
 * PaymentProvider e altere `activeProvider` abaixo.
 */
export type PaymentMethod = "cartao" | "pix" | "boleto";

export type CardData = { number: string; name: string; expiry: string; cvv: string; installments: number };

export type PaymentRequest = { amount: number; method: PaymentMethod; card?: CardData };

export type PaymentResult = {
  status: "aprovado_teste" | "pendente" | "recusado_teste";
  reference: string;
  message: string;
  pixCode?: string;
  boletoLine?: string;
};

export interface PaymentProvider {
  id: string;
  label: string;
  methods: PaymentMethod[];
  maxInstallments: number;
  charge(req: PaymentRequest): Promise<PaymentResult>;
}

const ref = (prefix = "STRIPE-TEST") =>
  `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

export const StripeTestProvider: PaymentProvider = {
  id: "stripe_test",
  label: "Stripe Sandbox (Modo Teste)",
  methods: ["cartao", "pix", "boleto"],
  maxInstallments: 12,
  async charge(req) {
    await new Promise((r) => setTimeout(r, 1200));

    if (req.method === "pix") {
      return {
        status: "aprovado_teste",
        reference: ref("STRIPE-PIX"),
        message: "PIX de teste confirmado com sucesso via Stripe.",
        pixCode: "00020126TESTE-STRIPE-ELIZA-PIX" + Date.now(),
      };
    }

    if (req.method === "boleto") {
      return {
        status: "pendente",
        reference: ref("STRIPE-BOL"),
        message: "Boleto de teste Stripe gerado. Aguardando compensação.",
        boletoLine: "34191.79001 01043.510047 91020.150008 0 " + Math.floor(req.amount * 100),
      };
    }

    // Regras de validação baseadas nos cartões de teste oficiais da Stripe
    const digits = (req.card?.number ?? "").replace(/\D/g, "");

    if (digits.endsWith("0002")) {
      return {
        status: "recusado_teste",
        reference: ref(),
        message: "Cartão recusado pelo emissor (Stripe test: card_declined).",
      };
    }

    if (digits.endsWith("0999")) {
      return {
        status: "recusado_teste",
        reference: ref(),
        message: "Saldo insuficiente (Stripe test: insufficient_funds).",
      };
    }

    if (digits.endsWith("0115")) {
      return {
        status: "recusado_teste",
        reference: ref(),
        message: "Cartão expirado (Stripe test: expired_card).",
      };
    }

    if (digits.endsWith("0127")) {
      return {
        status: "recusado_teste",
        reference: ref(),
        message: "Código de segurança CVC incorreto (Stripe test: incorrect_cvc).",
      };
    }

    if (digits.length < 13) {
      return {
        status: "recusado_teste",
        reference: ref(),
        message: "Número de cartão de teste inválido. Utilize 4242 4242 4242 4242.",
      };
    }

    return {
      status: "aprovado_teste",
      reference: ref(),
      message: "Pagamento de teste aprovado pelo Stripe (status: succeeded).",
    };
  },
};

export const activeProvider: PaymentProvider = StripeTestProvider;
