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

const ref = () => "TEST-" + Math.random().toString(36).slice(2, 10).toUpperCase();

export const TestProvider: PaymentProvider = {
  id: "test",
  label: "Ambiente de testes Eliza",
  methods: ["cartao", "pix", "boleto"],
  maxInstallments: 6,
  async charge(req) {
    await new Promise((r) => setTimeout(r, 1200));
    if (req.method === "pix")
      return {
        status: "aprovado_teste",
        reference: ref(),
        message: "PIX de teste confirmado automaticamente.",
        pixCode: "00020126TESTE-ELIZA-LINGERIE-PIX" + Date.now(),
      };
    if (req.method === "boleto")
      return {
        status: "pendente",
        reference: ref(),
        message: "Boleto de teste gerado. Aguardando pagamento.",
        boletoLine: "34191.79001 01043.510047 91020.150008 0 " + Math.floor(req.amount * 100),
      };
    const digits = (req.card?.number ?? "").replace(/\D/g, "");
    if (digits.endsWith("0002"))
      return { status: "recusado_teste", reference: ref(), message: "Cartão de teste recusado." };
    if (digits.length < 13) return { status: "recusado_teste", reference: ref(), message: "Número de cartão inválido." };
    return { status: "aprovado_teste", reference: ref(), message: "Pagamento de teste aprovado." };
  },
};

export const activeProvider: PaymentProvider = TestProvider;
