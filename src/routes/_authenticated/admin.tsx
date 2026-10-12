import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  brl,
  categoryLabel,
  CATEGORIES,
  productImage,
  getCustomProducts,
  saveCustomProduct,
  deleteCustomProduct,
  type MockProduct,
  type MockProductVariant,
} from "@/lib/catalog";
import {
  ORDER_STATUSES,
  PAYMENT_LABEL,
  STATUS_LABEL,
  dateBR,
  generateOrderNotificationEmail,
} from "@/lib/orders";
import {
  sendOrderStatusEmail,
  getStoreSetting,
  updateStoreSetting,
} from "@/lib/integrations.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Edit3,
  Image as ImageIcon,
  Upload,
  Mail,
  Copy,
  ExternalLink,
  Truck,
  MessageCircle,
  Search,
  Check,
  User,
  UserCheck,
  Eye,
  MapPin,
  Calendar,
  CreditCard,
  ShoppingBag,
  FileText,
  Phone,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel das Proprietárias — Eliza Lingerie" },
      { name: "description", content: "Gestão completa de estoque, catálogo, pedidos e clientes." },
      { property: "og:title", content: "Painel Admin — Eliza Lingerie" },
      {
        property: "og:description",
        content: "Gestão completa de estoque, catálogo, pedidos e clientes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { isAdmin, loading } = useAuth();
  if (loading)
    return (
      <p className="mx-auto max-w-7xl px-4 sm:px-6 py-12 text-muted-foreground">Carregando…</p>
    );
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-4xl font-display">Acesso restrito</h1>
        <p className="mt-3 text-muted-foreground">
          Esta área é exclusiva das proprietárias da Eliza Lingerie.
        </p>
        <Link to="/" className="mt-6 inline-block underline">
          Voltar ao início
        </Link>
      </div>
    );
  return <AdminPanel />;
}

// Sample fallback order for instant preview if Supabase orders table is empty
const SAMPLE_MOCK_ORDER = {
  id: "ord_sample_7821a",
  user_id: "usr_mock_1",
  status: "pago",
  payment_method: "cartao",
  payment_status: "aprovado_teste",
  payment_reference: "STRIPE-TEST-4242",
  subtotal: 259.8,
  shipping: 0,
  total: 259.8,
  shipping_service: "SEDEX",
  created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
  shipping_address: {
    recipient: "Mariana Albuquerque",
    phone: "(11) 98765-4321",
    street: "Alameda dos Anjos",
    number: "142",
    complement: "Apto 32",
    neighborhood: "Jardins",
    city: "São Paulo",
    state: "SP",
    cep: "01420-000",
    tracking_code: "",
  },
  order_items: [
    {
      id: "item_1",
      order_id: "ord_sample_7821a",
      product_name: "Conjunto Rendado Aurora",
      size: "M",
      color: "Rosé",
      quantity: 1,
      unit_price: 189.9,
    },
    {
      id: "item_2",
      order_id: "ord_sample_7821a",
      product_name: "Calcinha Algodão Essencial",
      size: "M",
      color: "Marfim",
      quantity: 1,
      unit_price: 69.9,
    },
  ],
};

const SAMPLE_MOCK_CUSTOMER = {
  id: "usr_mock_1",
  full_name: "Mariana Albuquerque",
  cpf: "123.456.789-00",
  phone: "(11) 98765-4321",
  birth_date: "1994-08-15",
  cep: "01420-000",
  street: "Alameda dos Anjos",
  number: "142",
  complement: "Apto 32",
  neighborhood: "Jardins",
  city: "São Paulo",
  state: "SP",
  delivery_notes: "Portaria 24h, deixar na recepção do condomínio.",
  created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
};

export interface CustomerAccountDetails {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate?: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  deliveryNotes?: string;
  createdAt?: string;
}

export interface AdminOrderItem {
  id?: string;
  order_id?: string;
  product_name: string;
  size?: string;
  color?: string;
  quantity: number;
  unit_price?: number;
}

export interface AdminOrderSummary {
  id: string;
  user_id: string;
  status: string;
  payment_method?: string;
  payment_status?: string;
  total?: number | string;
  created_at: string;
  shipping_address?: Record<string, unknown> | null;
  order_items?: AdminOrderItem[] | null;
}

function AdminPanel() {
  const qc = useQueryClient();
  const sendEmailFn = useServerFn(sendOrderStatusEmail);
  const getSettingFn = useServerFn(getStoreSetting);
  const updateSettingFn = useServerFn(updateStoreSetting);

  // Queries
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      try {
        const res = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .order("created_at", { ascending: false });
        if (res.data && res.data.length > 0) return res.data;
        return [SAMPLE_MOCK_ORDER];
      } catch {
        return [SAMPLE_MOCK_ORDER];
      }
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      try {
        const res = await supabase
          .from("products")
          .select("*, product_variants(*)")
          .order("category");
        if (res.data && res.data.length > 0) return res.data as MockProduct[];
        return getCustomProducts();
      } catch {
        return getCustomProducts();
      }
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      try {
        const res = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });
        if (res.data && res.data.length > 0) return res.data;
        return [SAMPLE_MOCK_CUSTOMER];
      } catch {
        return [SAMPLE_MOCK_CUSTOMER];
      }
    },
  });

  // Product Dialog States
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MockProduct | null>(null);
  const [deleteProductConfirm, setDeleteProductConfirm] = useState<MockProduct | null>(null);

  // Email Notification Dialog State
  type OrderWithItems = (typeof orders)[number];
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedOrderForEmail, setSelectedOrderForEmail] = useState<OrderWithItems | null>(null);
  const [emailTargetStatus, setEmailTargetStatus] = useState("enviado");
  const [emailTrackingCode, setEmailTrackingCode] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  // Customer Account Dialog State
  const [customerAccountModalOpen, setCustomerAccountModalOpen] = useState(false);
  const [selectedCustomerAccount, setSelectedCustomerAccount] =
    useState<CustomerAccountDetails | null>(null);
  const [selectedCustomerOrders, setSelectedCustomerOrders] = useState<OrderWithItems[]>([]);

  // Search & Filters for Products
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");

  // Store Settings (e-mail remetente + modelo da mensagem de notificação)
  const [notificationEmail, setNotificationEmail] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const { data: savedNotificationEmail } = useQuery({
    queryKey: ["store-setting", "notification_email"],
    queryFn: async () => {
      const res = await getSettingFn({ data: { key: "notification_email" } });
      return res.value || "";
    },
  });
  const { data: savedNotificationMessage } = useQuery({
    queryKey: ["store-setting", "notification_message"],
    queryFn: async () => {
      const res = await getSettingFn({ data: { key: "notification_message" } });
      return res.value || "";
    },
  });
  useEffect(() => {
    if (savedNotificationEmail !== undefined) setNotificationEmail(savedNotificationEmail);
  }, [savedNotificationEmail]);
  useEffect(() => {
    if (savedNotificationMessage !== undefined) setNotificationMessage(savedNotificationMessage);
  }, [savedNotificationMessage]);

  const saveNotificationEmail = async () => {
    if (!/^\S+@\S+\.\S+$/.test(notificationEmail.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setSavingSettings(true);
    try {
      await updateSettingFn({
        data: { key: "notification_email", value: notificationEmail.trim() },
      });
      await updateSettingFn({
        data: { key: "notification_message", value: notificationMessage },
      });
      qc.invalidateQueries({ queryKey: ["store-setting"] });
      toast.success("Configurações de notificação atualizadas!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Computed metrics
  const revenue = (orders ?? [])
    .filter((o) => o.status !== "cancelado" && o.status !== "pendente")
    .reduce((s, o) => s + Number(o.total), 0);
  const lowStock = (products ?? [])
    .flatMap((p) => p.product_variants ?? [])
    .filter((v) => v.stock <= 3).length;
  const customerName = (id: string) => customers.find((c) => c.id === id)?.full_name || "—";

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchCat = productCategoryFilter === "all" || p.category === productCategoryFilter;
    const matchSearch =
      !productSearch ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      categoryLabel(p.category).toLowerCase().includes(productSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  // Handler to open email modal
  const openEmailModal = (order: OrderWithItems, initialStatus?: string) => {
    setSelectedOrderForEmail(order);
    setEmailTargetStatus(initialStatus || order.status || "enviado");
    // Starts blank as required
    setEmailTrackingCode("");
    setEmailModalOpen(true);
  };

  // Handler to open customer account modal from any order
  const openCustomerAccount = (order: OrderWithItems) => {
    const addr = (order.shipping_address as Record<string, string>) || {};
    const foundProfile = customers.find((c) => c.id === order.user_id);
    const resolvedName = addr["recipient"] || foundProfile?.full_name || "Cliente Eliza";
    const resolvedPhone = addr["phone"] || foundProfile?.phone || "";
    const resolvedEmail =
      addr["email"] ||
      (foundProfile as { email?: string } | undefined)?.email ||
      `cliente_${order.user_id.slice(0, 6)}@email.com`;

    const accountData: CustomerAccountDetails = {
      id: order.user_id,
      fullName: resolvedName,
      email: resolvedEmail,
      phone: resolvedPhone,
      cpf: foundProfile?.cpf || addr["cpf"] || "",
      birthDate: foundProfile?.birth_date || "",
      cep: foundProfile?.cep || addr["cep"] || "",
      street: foundProfile?.street || addr["street"] || "",
      number: foundProfile?.number || addr["number"] || "",
      complement: foundProfile?.complement || addr["complement"] || "",
      neighborhood: foundProfile?.neighborhood || addr["neighborhood"] || "",
      city: foundProfile?.city || addr["city"] || "",
      state: foundProfile?.state || addr["state"] || "",
      deliveryNotes: foundProfile?.delivery_notes || addr["delivery_notes"] || "",
      createdAt: foundProfile?.created_at || order.created_at,
    };

    // Filter all orders by this customer
    const clientOrders = orders.filter(
      (o) =>
        o.user_id === order.user_id ||
        (o.shipping_address as Record<string, string>)?.["recipient"] === resolvedName,
    );

    setSelectedCustomerAccount(accountData);
    setSelectedCustomerOrders(clientOrders);
    setCustomerAccountModalOpen(true);
  };

  // Handler to open customer account modal directly from profile
  const openCustomerAccountFromProfile = (customerProfile: (typeof customers)[number]) => {
    const clientOrders = orders.filter((o) => o.user_id === customerProfile.id);
    const lastOrderAddr = (clientOrders[0]?.shipping_address as Record<string, string>) || {};

    const accountData: CustomerAccountDetails = {
      id: customerProfile.id,
      fullName: customerProfile.full_name || lastOrderAddr["recipient"] || "Cliente Eliza",
      email:
        (customerProfile as { email?: string })?.email ||
        lastOrderAddr["email"] ||
        `cliente_${customerProfile.id.slice(0, 6)}@email.com`,
      phone: customerProfile.phone || lastOrderAddr["phone"] || "",
      cpf: customerProfile.cpf || lastOrderAddr["cpf"] || "",
      birthDate: customerProfile.birth_date || "",
      cep: customerProfile.cep || lastOrderAddr["cep"] || "",
      street: customerProfile.street || lastOrderAddr["street"] || "",
      number: customerProfile.number || lastOrderAddr["number"] || "",
      complement: customerProfile.complement || lastOrderAddr["complement"] || "",
      neighborhood: customerProfile.neighborhood || lastOrderAddr["neighborhood"] || "",
      city: customerProfile.city || lastOrderAddr["city"] || "",
      state: customerProfile.state || lastOrderAddr["state"] || "",
      deliveryNotes: customerProfile.delivery_notes || lastOrderAddr["delivery_notes"] || "",
      createdAt: customerProfile.created_at,
    };

    setSelectedCustomerAccount(accountData);
    setSelectedCustomerOrders(clientOrders);
    setCustomerAccountModalOpen(true);
  };

  // Handler to confirm status and send email
  const handleConfirmStatusAndSendEmail = async () => {
    if (!selectedOrderForEmail) return;
    setEmailSending(true);

    const addr = (selectedOrderForEmail.shipping_address as Record<string, string>) || {};
    const recipientName =
      addr["recipient"] || customerName(selectedOrderForEmail.user_id) || "Cliente";

    const emailDetails = generateOrderNotificationEmail({
      orderId: selectedOrderForEmail.id,
      customerName: recipientName,
      status: emailTargetStatus,
      trackingCode: emailTrackingCode,
      items: selectedOrderForEmail.order_items ?? [],
      total: Number(selectedOrderForEmail.total),
      shippingAddress: addr,
    });

    try {
      await sendEmailFn({
        data: {
          orderId: selectedOrderForEmail.id,
          status: emailTargetStatus,
          trackingCode: emailTrackingCode.trim(),
          customerName: recipientName,
          customerEmail: addr["email"] || "",
          subject: emailDetails.subject,
          content: emailDetails.body,
        },
      });

      try {
        const updatedAddress = {
          ...addr,
          tracking_code: emailTrackingCode.trim(),
          last_status_notification: new Date().toISOString(),
        };
        await supabase
          .from("orders")
          .update({
            status: emailTargetStatus,
            shipping_address: updatedAddress,
          })
          .eq("id", selectedOrderForEmail.id);
      } catch (err) {
        console.warn("Fallback de banco de pedidos:", err);
      }

      toast.success(
        `E-mail enviado para ${recipientName} com o status "${STATUS_LABEL[emailTargetStatus] ?? emailTargetStatus}"!`,
      );
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      setEmailModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar e-mail");
    } finally {
      setEmailSending(false);
    }
  };

  // Quick status update without sending email
  const handleUpdateStatusOnly = async (orderId: string, nextStatus: string) => {
    try {
      await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
      toast.success(`Status alterado para ${STATUS_LABEL[nextStatus] ?? nextStatus}`);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status");
    }
  };

  // Handler to delete product
  const handleDeleteProduct = async (product: MockProduct) => {
    try {
      await supabase.from("products").delete().eq("id", product.id);
    } catch (err) {
      console.warn("Fallback ao excluir produto do Supabase:", err);
    }
    deleteCustomProduct(product.id);
    toast.success(`Produto "${product.name}" removido com sucesso.`);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    setDeleteProductConfirm(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-muted-foreground">Gestão da Loja</p>
          <h1 className="text-3xl sm:text-5xl font-display">Painel das Proprietárias</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEditingProduct(null);
              setProductModalOpen(true);
            }}
            className="rounded-none eyebrow gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Produto</span>
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Total Pedidos" value={String(orders.length)} />
        <Stat label="Faturamento" value={brl(revenue)} />
        <Stat
          label="Produtos Ativos"
          value={String(products.filter((p) => p.active !== false).length)}
        />
        <Stat label="Estoque Baixo" value={String(lowStock)} alert={lowStock > 0} />
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="pedidos" className="mt-10">
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-muted/60 border rounded-none">
          <TabsTrigger value="pedidos" className="rounded-none px-4 py-2 font-medium">
            Pedidos & Rastreio ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="produtos" className="rounded-none px-4 py-2 font-medium">
            Catálogo & CRUD
          </TabsTrigger>
          <TabsTrigger value="estoque" className="rounded-none px-4 py-2 font-medium">
            Estoque Rápido
          </TabsTrigger>
          <TabsTrigger value="config" className="rounded-none px-4 py-2 font-medium">
            Configurações
          </TabsTrigger>
          <TabsTrigger value="clientes" className="rounded-none px-4 py-2 font-medium">
            Clientes ({customers.length})
          </TabsTrigger>
        </TabsList>

        {/* ----------------- TAB: PEDIDOS & RASTREIO ----------------- */}
        <TabsContent value="pedidos" className="mt-6 space-y-4">
          <div className="border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium text-foreground">Gestão de Pedidos, Clientes & Rastreio</p>
              <p className="text-xs text-muted-foreground">
                Clique no nome do cliente ou no botão &quot;Conta&quot; para acessar o perfil
                completo do comprador. Para enviar e-mail com rastreio, clique em &quot;Notificar
                Cliente&quot;.
              </p>
            </div>
            <div className="text-xs text-muted-foreground border-l pl-3 hidden sm:block">
              {orders.length} pedidos registrados
            </div>
          </div>

          {/* Desktop Orders Table */}
          <div className="hidden md:block overflow-x-auto border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left eyebrow border-b">
                <tr>
                  <th className="p-3">Pedido</th>
                  <th className="p-3">Cliente & Contato</th>
                  <th className="p-3">Itens Comprados</th>
                  <th className="p-3">Pagamento</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => {
                  const a = (o.shipping_address as Record<string, string>) || {};
                  const tracking = a["tracking_code"] || "";
                  const cName = a["recipient"] || customerName(o.user_id);

                  return (
                    <tr key={o.id} className="align-top hover:bg-muted/30 transition-colors">
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-mono font-semibold">
                          #{o.id.slice(0, 8).toUpperCase()}
                        </span>
                        <div className="text-xs text-muted-foreground">{dateBR(o.created_at)}</div>
                        {tracking && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded-sm w-fit">
                            <Truck className="h-3 w-3" />
                            {tracking}
                          </div>
                        )}
                      </td>

                      {/* Cliente com link de acesso rápido à conta */}
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => openCustomerAccount(o)}
                          className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5 group text-left cursor-pointer"
                          title="Clique para ver os dados da conta deste cliente"
                        >
                          <span className="underline decoration-dotted underline-offset-2">
                            {cName}
                          </span>
                          <User className="h-3.5 w-3.5 text-primary opacity-70 group-hover:opacity-100 shrink-0" />
                        </button>

                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          {a["phone"] && (
                            <a
                              href={`https://wa.me/55${a["phone"].replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:underline flex items-center gap-1"
                            >
                              <MessageCircle className="h-3 w-3 inline" />
                              {a["phone"]}
                            </a>
                          )}
                          <div>
                            {a["street"]}, {a["number"]} — {a["city"]}/{a["state"]}
                          </div>
                          <button
                            type="button"
                            onClick={() => openCustomerAccount(o)}
                            className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1 mt-1 cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Ver dados da conta</span>
                          </button>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="space-y-1 text-xs max-w-xs">
                          {o.order_items?.map((i) => (
                            <div key={i.id} className="text-foreground">
                              <strong>{i.quantity}×</strong> {i.product_name}{" "}
                              <span className="text-muted-foreground">
                                ({i.size}, {i.color})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <div className="font-medium capitalize">{o.payment_method}</div>
                        <div className="text-xs text-muted-foreground">
                          {PAYMENT_LABEL[o.payment_status] ?? o.payment_status}
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap font-medium">{brl(Number(o.total))}</td>

                      <td className="p-3">
                        <select
                          className="h-8 border bg-background px-2 text-xs rounded-none focus:outline-none"
                          value={o.status}
                          onChange={(e) => {
                            const newSt = e.target.value;
                            openEmailModal(o, newSt);
                          }}
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCustomerAccount(o)}
                            className="rounded-none h-8 px-2.5 gap-1.5 hover:bg-muted"
                            title="Acessar informações da conta do cliente"
                          >
                            <UserCheck className="h-3.5 w-3.5 text-primary" />
                            <span>Conta</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEmailModal(o)}
                            className="rounded-none h-8 px-2.5 gap-1.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                            title="Atualizar status e enviar e-mail de rastreio"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            <span>Notificar</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Nenhum pedido recebido ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Orders Cards (<768px) */}
          <div className="block md:hidden space-y-4">
            {orders.map((o) => {
              const a = (o.shipping_address as Record<string, string>) || {};
              const tracking = a["tracking_code"] || "";
              const cName = a["recipient"] || customerName(o.user_id);

              return (
                <div key={o.id} className="border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-sm">
                        #{o.id.slice(0, 8).toUpperCase()}
                      </span>
                      <p className="text-xs text-muted-foreground">{dateBR(o.created_at)}</p>
                    </div>
                    <span className="font-semibold text-primary">{brl(Number(o.total))}</span>
                  </div>

                  <div className="text-xs border-y py-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => openCustomerAccount(o)}
                        className="font-semibold text-foreground flex items-center gap-1 text-left"
                      >
                        <span className="underline decoration-dotted">{cName}</span>
                        <User className="h-3.5 w-3.5 text-primary" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openCustomerAccount(o)}
                        className="text-xs text-primary font-medium flex items-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" /> Ver conta
                      </button>
                    </div>

                    {a["phone"] && (
                      <a
                        href={`https://wa.me/55${a["phone"].replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 flex items-center gap-1 font-medium"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {a["phone"]} (WhatsApp)
                      </a>
                    )}
                    <p className="text-muted-foreground">
                      {a["street"]}, {a["number"]} — {a["city"]}/{a["state"]}
                    </p>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openCustomerAccount(o)}
                      className="rounded-none w-full gap-2 text-xs h-8 border-dashed mt-2"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-primary" />
                      <span>Ver Informações da Conta do Cliente</span>
                    </Button>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="eyebrow text-muted-foreground">Itens:</p>
                    {o.order_items?.map((i) => (
                      <div key={i.id} className="flex justify-between">
                        <span>
                          {i.quantity}× {i.product_name} ({i.size}, {i.color})
                        </span>
                        {i.unit_price && <span>{brl(Number(i.unit_price) * i.quantity)}</span>}
                      </div>
                    ))}
                  </div>

                  {tracking && (
                    <div className="flex items-center gap-1 text-xs text-primary font-mono bg-primary/10 p-2 rounded-sm">
                      <Truck className="h-3.5 w-3.5 shrink-0" />
                      <span>Rastreio: {tracking}</span>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs eyebrow text-muted-foreground">Status:</span>
                      <select
                        className="h-9 border bg-background px-2 text-xs rounded-none flex-1"
                        value={o.status}
                        onChange={(e) => openEmailModal(o, e.target.value)}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEmailModal(o)}
                      className="rounded-none w-full gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground h-9"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Alterar Status & Notificar por E-mail</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ----------------- TAB: PRODUTOS (CRUD) ----------------- */}
        <TabsContent value="produtos" className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card p-4 border">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou categoria..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 rounded-none h-10"
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="h-10 border bg-background px-3 text-sm rounded-none focus:outline-none"
              >
                <option value="all">Todas as categorias</option>
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => {
                  setEditingProduct(null);
                  setProductModalOpen(true);
                }}
                className="rounded-none eyebrow gap-1.5 h-10 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Adicionar</span> Produto
              </Button>
            </div>
          </div>

          {/* Desktop Product Table */}
          <div className="hidden md:block overflow-x-auto border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left eyebrow border-b">
                <tr>
                  <th className="p-3 w-16">Foto</th>
                  <th className="p-3">Produto</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Preço</th>
                  <th className="p-3">Variantes & Cores</th>
                  <th className="p-3">Estoque</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProducts.map((p) => {
                  const variants = p.product_variants ?? [];
                  const totalUnits = variants.reduce((acc, v) => acc + (v.stock || 0), 0);

                  return (
                    <tr key={p.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3">
                        <img
                          src={productImage(p.image_key)}
                          alt={p.name}
                          className="h-14 w-12 rounded-sm bg-muted object-cover border"
                        />
                      </td>
                      <td className="p-3">
                        <p className="font-display text-base font-semibold text-foreground">
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                          {p.description}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 text-xs border rounded-sm bg-secondary/50">
                          {categoryLabel(p.category)}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{brl(Number(p.price))}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {variants.map((v) => (
                            <span
                              key={v.id}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] border bg-background rounded-sm"
                            >
                              <span
                                className="h-2 w-2 rounded-full border shrink-0"
                                style={{ backgroundColor: v.color_hex }}
                              />
                              {v.size} ({v.stock})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-medium ${totalUnits <= 5 ? "text-destructive font-bold" : "text-foreground"}`}
                        >
                          {totalUnits} un.
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-sm ${
                            p.active !== false
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-zinc-200 text-zinc-700"
                          }`}
                        >
                          {p.active !== false ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingProduct(p);
                              setProductModalOpen(true);
                            }}
                            className="rounded-none h-8 px-2.5 gap-1"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteProductConfirm(p)}
                            className="rounded-none h-8 px-2 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-muted-foreground">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Product Cards (<768px) */}
          <div className="block md:hidden space-y-4">
            {filteredProducts.map((p) => {
              const variants = p.product_variants ?? [];
              const totalUnits = variants.reduce((acc, v) => acc + (v.stock || 0), 0);

              return (
                <div key={p.id} className="border bg-card p-4 space-y-3">
                  <div className="flex gap-3">
                    <img
                      src={productImage(p.image_key)}
                      alt={p.name}
                      className="h-20 w-16 rounded-sm bg-muted object-cover border shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-display text-lg font-medium leading-tight truncate">
                          {p.name}
                        </p>
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm ${
                            p.active !== false
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-zinc-200 text-zinc-700"
                          }`}
                        >
                          {p.active !== false ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <p className="eyebrow text-muted-foreground mt-0.5">
                        {categoryLabel(p.category)}
                      </p>
                      <p className="mt-1 font-semibold text-primary">{brl(Number(p.price))}</p>
                    </div>
                  </div>

                  <div className="border-t pt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Estoque total: <strong className="text-foreground">{totalUnits} un.</strong>
                    </span>
                    <span>{variants.length} variações</span>
                  </div>

                  <div className="flex gap-2 pt-1 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingProduct(p);
                        setProductModalOpen(true);
                      }}
                      className="rounded-none flex-1 gap-1.5 h-9"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteProductConfirm(p)}
                      className="rounded-none h-9 px-3 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ----------------- TAB: ESTOQUE RÁPIDO ----------------- */}
        <TabsContent value="estoque" className="mt-6 space-y-6">
          {products.map((p) => (
            <div key={p.id} className="border bg-card p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <img
                    src={productImage(p.image_key)}
                    alt=""
                    className="h-10 w-8 rounded-sm object-cover border bg-muted"
                  />
                  <div>
                    <p className="font-display text-lg sm:text-xl">{p.name}</p>
                    <p className="eyebrow text-muted-foreground text-xs">
                      {categoryLabel(p.category)} · {brl(Number(p.price))}
                    </p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Total em estoque:{" "}
                  <strong className="text-foreground">
                    {(p.product_variants ?? []).reduce((s, v) => s + v.stock, 0)} un.
                  </strong>
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {(p.product_variants ?? [])
                  .sort((a, b) => a.color.localeCompare(b.color) || a.size.localeCompare(b.size))
                  .map((v) => (
                    <StockCell
                      key={v.id}
                      id={v.id}
                      label={`${v.size} · ${v.color}`}
                      hex={v.color_hex}
                      stock={v.stock}
                    />
                  ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* ----------------- TAB: CLIENTES ----------------- */}
        <TabsContent value="config" className="mt-6 space-y-6">
          <div className="border bg-card p-6 max-w-xl">
            <h3 className="font-display text-2xl">Notificações por e-mail</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              E-mail padrão da loja usado nas notificações de pedidos (remetente de contato e
              destino alternativo quando o cliente não tem e-mail de cadastro).
            </p>
            <div className="mt-5 space-y-2">
              <Label htmlFor="notification-email">E-mail de notificação</Label>
              <Input
                id="notification-email"
                type="email"
                placeholder="contato@elizalingerie.com.br"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
              />
            </div>
            <Button
              className="mt-4 rounded-none"
              onClick={saveNotificationEmail}
              disabled={savingSettings}
            >
              {savingSettings ? "Salvando…" : "Salvar configurações"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="mt-6 space-y-4">
          <div className="border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium text-foreground">Base de Clientes Eliza Lingerie</p>
              <p className="text-xs text-muted-foreground">
                Consulte cadastros completos, endereços de entrega, CPFs e histórico de compras de
                cada cliente.
              </p>
            </div>
            <div className="text-xs text-muted-foreground border-l pl-3 hidden sm:block">
              {customers.length} clientes cadastrados
            </div>
          </div>

          {/* Desktop Clientes Table */}
          <div className="hidden md:block overflow-x-auto border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left eyebrow border-b">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Telefone</th>
                  <th className="p-3">CPF</th>
                  <th className="p-3">Endereço</th>
                  <th className="p-3 text-center">Pedidos</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map((c) => {
                  const clientOrdersCount = orders.filter((o) => o.user_id === c.id).length;
                  return (
                    <tr key={c.id} className="align-top hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => openCustomerAccountFromProfile(c)}
                          className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5 group text-left cursor-pointer"
                          title="Clique para ver os dados da conta deste cliente"
                        >
                          <span className="underline decoration-dotted underline-offset-2">
                            {c.full_name || "—"}
                          </span>
                          <User className="h-3.5 w-3.5 text-primary opacity-70 group-hover:opacity-100 shrink-0" />
                        </button>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Cadastrado desde {dateBR(c.created_at)}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {c.phone ? (
                          <a
                            className="text-emerald-700 hover:underline flex items-center gap-1"
                            href={`https://wa.me/55${c.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle className="h-3 w-3 inline" />
                            {c.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-xs whitespace-nowrap">
                        {c.cpf || "—"}
                      </td>
                      <td className="p-3 text-xs max-w-xs">
                        {c.street ? (
                          <div>
                            {c.street}, {c.number || "S/N"} — {c.neighborhood}, {c.city}/{c.state} ·
                            CEP {c.cep}
                            {c.delivery_notes && (
                              <div className="text-muted-foreground mt-0.5">
                                Obs: {c.delivery_notes}
                              </div>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-center font-medium">
                        <span className="inline-block px-2 py-0.5 rounded-sm bg-muted text-xs font-semibold">
                          {clientOrdersCount}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCustomerAccountFromProfile(c)}
                          className="rounded-none h-8 px-2.5 gap-1.5 hover:bg-muted"
                          title="Acessar informações da conta do cliente"
                        >
                          <UserCheck className="h-3.5 w-3.5 text-primary" />
                          <span>Ver Conta</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Nenhum cliente cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Clientes Cards (< 768px) */}
          <div className="block md:hidden space-y-3">
            {customers.map((c) => {
              const clientOrdersCount = orders.filter((o) => o.user_id === c.id).length;
              return (
                <div key={c.id} className="border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => openCustomerAccountFromProfile(c)}
                        className="font-display text-lg font-medium text-foreground hover:text-primary flex items-center gap-1.5 text-left"
                      >
                        <span className="underline decoration-dotted">{c.full_name || "—"}</span>
                        <User className="h-4 w-4 text-primary shrink-0" />
                      </button>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Cadastrado desde {dateBR(c.created_at)}
                      </p>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-sm">
                      {clientOrdersCount} {clientOrdersCount === 1 ? "pedido" : "pedidos"}
                    </span>
                  </div>

                  <div className="text-xs border-y py-2 space-y-1">
                    {c.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Telefone:</span>
                        <a
                          href={`https://wa.me/55${c.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 font-semibold flex items-center gap-1 hover:underline"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {c.phone}
                        </a>
                      </div>
                    )}

                    {c.cpf && (
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-muted-foreground font-sans">CPF:</span>
                        <span>{c.cpf}</span>
                      </div>
                    )}

                    {c.street && (
                      <div className="text-muted-foreground pt-1">
                        {c.street}, {c.number || "S/N"} — {c.neighborhood}, {c.city}/{c.state} ·{" "}
                        {c.cep}
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openCustomerAccountFromProfile(c)}
                    className="rounded-none w-full gap-2 text-xs h-9"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Ver Informações da Conta Completa</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ============================================================== */}
      {/* MODAL 1: PRODUTO CRUD (CRIAR / EDITAR COM UPLOAD DE IMAGEM)     */}
      {/* ============================================================== */}
      <ProductFormDialog
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        initialProduct={editingProduct}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-products"] });
          qc.invalidateQueries({ queryKey: ["products"] });
        }}
      />

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteProductConfirm && (
        <Dialog open={!!deleteProductConfirm} onOpenChange={() => setDeleteProductConfirm(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Excluir produto</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o produto &quot;{deleteProductConfirm.name}&quot;?
                Esta ação removerá o item e suas variações da loja.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteProductConfirm(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteProduct(deleteProductConfirm)}
              >
                Sim, Excluir Produto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: NOTIFICAÇÃO DE E-MAIL AO MODIFICAR STATUS DE COMPRA  */}
      {/* ============================================================== */}
      {selectedOrderForEmail && (
        <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-2xl">
                <Mail className="h-5 w-5 text-primary" />
                <span>Atualizar Pedido & Notificar Cliente</span>
              </DialogTitle>
              <DialogDescription>
                Atualize o status do pedido #{selectedOrderForEmail.id.slice(0, 8).toUpperCase()} e
                envie o e-mail oficial com a saudação, lista de produtos e o código de rastreio da
                transportadora.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider font-semibold">
                    Novo Status do Pedido
                  </Label>
                  <select
                    value={emailTargetStatus}
                    onChange={(e) => setEmailTargetStatus(e.target.value)}
                    className="mt-1.5 w-full h-10 border bg-background px-3 text-sm rounded-none focus:outline-none"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider font-semibold flex items-center justify-between">
                    <span>Código de Rastreio</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      (Transportadora)
                    </span>
                  </Label>
                  <Input
                    placeholder="Ex: BR123456789BR ou QD987654321BR"
                    value={emailTrackingCode}
                    onChange={(e) => setEmailTrackingCode(e.target.value)}
                    className="mt-1.5 rounded-none font-mono uppercase h-10"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Cole o código gerado pelos Correios / Melhor Envio / Jadlog.
                  </p>
                </div>
              </div>

              {(() => {
                const addr =
                  (selectedOrderForEmail.shipping_address as Record<string, string>) || {};
                const cName =
                  addr["recipient"] || customerName(selectedOrderForEmail.user_id) || "Cliente";
                const emailData = generateOrderNotificationEmail({
                  orderId: selectedOrderForEmail.id,
                  customerName: cName,
                  status: emailTargetStatus,
                  trackingCode: emailTrackingCode,
                  items: selectedOrderForEmail.order_items ?? [],
                  total: Number(selectedOrderForEmail.total),
                  shippingAddress: addr,
                });

                return (
                  <div className="border bg-muted/40 p-3 sm:p-4 rounded-sm space-y-2">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-xs font-semibold eyebrow text-muted-foreground">
                        Pré-visualização da Caixa de E-mail
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(emailData.body);
                          toast.success("Conteúdo do e-mail copiado para a área de transferência!");
                        }}
                        className="h-7 text-xs gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copiar Texto</span>
                      </Button>
                    </div>

                    <div className="text-xs space-y-1 text-muted-foreground">
                      <p>
                        <strong className="text-foreground">Para:</strong> {cName}{" "}
                        {addr["phone"] && `(${addr["phone"]})`}
                      </p>
                      <p>
                        <strong className="text-foreground">Assunto:</strong> {emailData.subject}
                      </p>
                    </div>

                    <div className="bg-background border p-3.5 rounded-sm font-sans text-xs whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                      {emailData.body}
                    </div>

                    {addr["phone"] && (
                      <div className="pt-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Deseja também avisar pelo WhatsApp?
                        </span>
                        <a
                          href={`https://wa.me/55${addr["phone"].replace(/\D/g, "")}?text=${emailData.whatsappMessage}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>Abrir WhatsApp com a mensagem</span>
                        </a>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await handleUpdateStatusOnly(selectedOrderForEmail.id, emailTargetStatus);
                  setEmailModalOpen(false);
                }}
                disabled={emailSending}
                className="rounded-none order-2 sm:order-1 text-xs"
              >
                Apenas Atualizar Status (sem e-mail)
              </Button>

              <Button
                type="button"
                onClick={handleConfirmStatusAndSendEmail}
                disabled={emailSending}
                className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 order-1 sm:order-2 gap-2"
              >
                {emailSending ? (
                  <span>Enviando notificação...</span>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    <span>Salvar Status & Enviar E-mail</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: INFORMAÇÕES DA CONTA DO CLIENTE (ATRAVÉS DOS PEDIDOS) */}
      {/* ============================================================== */}
      <CustomerAccountDialog
        open={customerAccountModalOpen}
        onOpenChange={setCustomerAccountModalOpen}
        customer={selectedCustomerAccount}
        orders={selectedCustomerOrders}
      />
    </div>
  );
}

// -------------------------------------------------------------
// COMPONENTE: DIALOG DE INFORMAÇÕES DA CONTA DO CLIENTE
// -------------------------------------------------------------
interface CustomerAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerAccountDetails | null;
  orders: any[];
}

function CustomerAccountDialog({
  open,
  onOpenChange,
  customer,
  orders,
}: CustomerAccountDialogProps) {
  if (!customer) return null;

  const totalSpent = orders.reduce((acc, o) => acc + Number(o.total || 0), 0);
  const initials = customer.fullName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleCopyCustomerDossier = () => {
    const text = `FICHA DO CLIENTE — ELIZA LINGERIE
Nome: ${customer.fullName}
E-mail: ${customer.email}
Telefone: ${customer.phone || "Não informado"}
CPF: ${customer.cpf || "Não informado"}
${customer.birthDate ? `Data de Nascimento: ${dateBR(customer.birthDate)}` : ""}
Endereço: ${customer.street}, ${customer.number || "S/N"}${customer.complement ? ` - ${customer.complement}` : ""}
Bairro: ${customer.neighborhood} - ${customer.city}/${customer.state}
CEP: ${customer.cep}
${customer.deliveryNotes ? `Observações de Entrega: ${customer.deliveryNotes}` : ""}
Total de Pedidos Realizados: ${orders.length}
Faturamento Total deste Cliente: ${brl(totalSpent)}`;

    navigator.clipboard.writeText(text);
    toast.success("Dados cadastrais do cliente copiados para a área de transferência!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <UserCheck className="h-6 w-6 text-primary" />
            <span>Informações da Conta do Cliente</span>
          </DialogTitle>
          <DialogDescription>
            Dados cadastrais completos, endereço de entrega e histórico de pedidos na loja.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Header do Cliente com Avatar e Métricas */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/30 border rounded-sm">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground font-display font-semibold flex items-center justify-center text-lg shrink-0">
                {initials || "EL"}
              </div>
              <div>
                <p className="font-display text-xl font-semibold text-foreground leading-tight">
                  {customer.fullName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ID: <span className="font-mono">{customer.id.slice(0, 12)}...</span> · Cadastrado{" "}
                  {customer.createdAt ? `desde ${dateBR(customer.createdAt)}` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 border-t sm:border-t-0 pt-2 sm:pt-0">
              <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-sm">
                {orders.length} {orders.length === 1 ? "pedido realizado" : "pedidos realizados"}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">
                Total Comprado: <strong className="text-foreground">{brl(totalSpent)}</strong>
              </span>
            </div>
          </div>

          {/* Cards de Dados Pessoais & Contato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Contato & Pessoais */}
            <div className="border p-4 bg-card rounded-sm space-y-3">
              <p className="eyebrow text-muted-foreground text-xs font-semibold flex items-center gap-1.5 border-b pb-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Dados de Contato</span>
              </p>

              <div className="text-xs space-y-2">
                <div>
                  <span className="text-muted-foreground block text-[11px]">E-mail da Conta:</span>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="font-medium text-foreground truncate">{customer.email}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(customer.email);
                        toast.success("E-mail copiado!");
                      }}
                      className="text-primary hover:opacity-80 p-0.5"
                      title="Copiar e-mail"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">
                    Telefone / Celular:
                  </span>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="font-medium text-foreground">
                      {customer.phone || "Não cadastrado"}
                    </span>
                    {customer.phone && (
                      <a
                        href={`https://wa.me/55${customer.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold hover:underline bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200"
                      >
                        <MessageCircle className="h-3 w-3" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">CPF:</span>
                  <span className="font-mono font-medium text-foreground">
                    {customer.cpf || "Não informado"}
                  </span>
                </div>

                {customer.birthDate && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Data de Nascimento:
                    </span>
                    <span className="font-medium text-foreground">
                      {dateBR(customer.birthDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Endereço de Entrega */}
            <div className="border p-4 bg-card rounded-sm space-y-3">
              <p className="eyebrow text-muted-foreground text-xs font-semibold flex items-center gap-1.5 border-b pb-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>Endereço Cadastrado</span>
              </p>

              <div className="text-xs space-y-2">
                <div>
                  <span className="text-muted-foreground block text-[11px]">CEP:</span>
                  <span className="font-mono font-medium text-foreground">
                    {customer.cep || "Não informado"}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Logradouro:</span>
                  <span className="font-medium text-foreground">
                    {customer.street
                      ? `${customer.street}, ${customer.number || "S/N"}`
                      : "Endereço não cadastrado"}
                    {customer.complement ? ` (${customer.complement})` : ""}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Bairro:</span>
                  <span className="font-medium text-foreground">
                    {customer.neighborhood || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">Cidade / Estado:</span>
                  <span className="font-medium text-foreground">
                    {customer.city ? `${customer.city} / ${customer.state}` : "—"}
                  </span>
                </div>

                {customer.deliveryNotes && (
                  <div className="bg-muted/40 p-2 rounded-sm border">
                    <span className="text-muted-foreground block text-[11px] font-semibold">
                      Observação de Entrega:
                    </span>
                    <span className="text-[11px] text-foreground">{customer.deliveryNotes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Histórico de Pedidos deste Cliente */}
          <div className="border p-4 bg-card rounded-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <p className="eyebrow text-muted-foreground text-xs font-semibold flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                <span>Histórico de Pedidos ({orders.length})</span>
              </p>
              <span className="text-xs font-medium text-primary">Total: {brl(totalSpent)}</span>
            </div>

            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="p-3 border rounded-sm text-xs bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/30"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">
                        #{o.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm border font-semibold bg-secondary/50">
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{dateBR(o.created_at)}</p>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">
                      {o.order_items
                        ?.map((it: AdminOrderItem) => `${it.quantity}× ${it.product_name}`)
                        .join(", ")}
                    </div>
                  </div>

                  <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                    <span className="font-semibold text-foreground text-sm">
                      {brl(Number(o.total))}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {o.payment_method}
                    </span>
                  </div>
                </div>
              ))}

              {orders.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-3">
                  Nenhum pedido anterior encontrado para este cliente.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
          {customer.phone && (
            <a
              href={`https://wa.me/55${customer.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 h-10 px-4 bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-semibold rounded-none transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Conversar no WhatsApp</span>
            </a>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleCopyCustomerDossier}
            className="rounded-none gap-1.5 text-xs h-10"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copiar Ficha do Cliente</span>
          </Button>

          <Button
            type="button"
            variant="default"
            onClick={() => onOpenChange(false)}
            className="rounded-none text-xs h-10"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------
// COMPONENTE: FORMULÁRIO DE PRODUTO (CRIAR & EDITAR COM FOTO)
// -------------------------------------------------------------
interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProduct: MockProduct | null;
  onSaved: () => void;
}

const COMMON_SIZES_ADULT = ["P", "M", "G", "GG"];
const COMMON_SIZES_KIDS = ["4", "6", "8", "10", "12"];

const COLOR_PALETTE = [
  { name: "Rosé", hex: "#D9A5A0" },
  { name: "Preto", hex: "#1E1A1A" },
  { name: "Marfim", hex: "#F1E9DC" },
  { name: "Branco", hex: "#FFFFFF" },
  { name: "Vinho", hex: "#6B1D2F" },
  { name: "Azul Céu", hex: "#A4C3D2" },
  { name: "Nude", hex: "#E2C2B3" },
];

function ProductFormDialog({
  open,
  onOpenChange,
  initialProduct,
  onSaved,
}: ProductFormDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("lingerie");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  // Image source modes: 'upload' | 'url' | 'preset'
  const [imageMode, setImageMode] = useState<"upload" | "url" | "preset">("preset");
  const [imageKey, setImageKey] = useState("lingerie");
  const [customImageUrl, setCustomImageUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Variants state
  const [variants, setVariants] = useState<MockProductVariant[]>([]);

  // New variant inputs
  const [newSize, setNewSize] = useState("M");
  const [newColorName, setNewColorName] = useState("Rosé");
  const [newColorHex, setNewColorHex] = useState("#D9A5A0");
  const [newStock, setNewStock] = useState("10");

  const [saving, setSaving] = useState(false);

  // Reset or fill data when modal opens
  const syncFromProduct = (p: MockProduct | null) => {
    if (p) {
      setName(p.name);
      setCategory(p.category);
      setPrice(String(p.price));
      setDescription(p.description || "");
      setActive(p.active !== false);
      setImageKey(p.image_key || "lingerie");
      if (p.image_key.startsWith("http") || p.image_key.startsWith("data:")) {
        setImageMode("upload");
        setCustomImageUrl(p.image_key);
      } else {
        setImageMode("preset");
      }
      setVariants(p.product_variants ? [...p.product_variants] : []);
    } else {
      setName("");
      setCategory("lingerie");
      setPrice("");
      setDescription("");
      setActive(true);
      setImageMode("preset");
      setImageKey("lingerie");
      setCustomImageUrl("");
      setVariants([
        {
          id: `v_p_${Date.now()}`,
          product_id: "",
          size: "P",
          color: "Rosé",
          color_hex: "#D9A5A0",
          stock: 10,
        },
        {
          id: `v_m_${Date.now()}`,
          product_id: "",
          size: "M",
          color: "Preto",
          color_hex: "#1E1A1A",
          stock: 12,
        },
        {
          id: `v_g_${Date.now()}`,
          product_id: "",
          size: "G",
          color: "Marfim",
          color_hex: "#F1E9DC",
          stock: 8,
        },
      ]);
    }
  };

  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    syncFromProduct(initialProduct);
  }
  prevOpenRef.current = open;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return toast.error("Selecione um arquivo de imagem válido (JPG, PNG ou WEBP).");
    }

    if (file.size > 5 * 1024 * 1024) {
      return toast.error("A imagem deve ter no máximo 5MB.");
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setCustomImageUrl(base64);
        setImageKey(base64);
        setImageMode("upload");
        toast.success("Imagem carregada com sucesso!");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddVariant = () => {
    if (!newSize.trim()) return toast.error("Informe o tamanho");
    if (!newColorName.trim()) return toast.error("Informe a cor");
    const stockVal = Math.max(0, parseInt(newStock) || 0);

    const exists = variants.some(
      (v) => v.size === newSize.trim() && v.color === newColorName.trim(),
    );
    if (exists) {
      return toast.error(`A variação ${newSize} / ${newColorName} já existe na lista.`);
    }

    setVariants([
      ...variants,
      {
        id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        product_id: initialProduct?.id || "",
        size: newSize.trim(),
        color: newColorName.trim(),
        color_hex: newColorHex,
        stock: stockVal,
      },
    ]);
    toast.success(`Tamanho ${newSize} (${newColorName}) adicionado!`);
  };

  const handleQuickAddSizes = (sizesList: string[]) => {
    const newItems: MockProductVariant[] = [];
    sizesList.forEach((s) => {
      const exists = variants.some((v) => v.size === s && v.color === newColorName);
      if (!exists) {
        newItems.push({
          id: `var_${Date.now()}_${s}`,
          product_id: initialProduct?.id || "",
          size: s,
          color: newColorName,
          color_hex: newColorHex,
          stock: 10,
        });
      }
    });
    if (newItems.length > 0) {
      setVariants([...variants, ...newItems]);
      toast.success(`${newItems.length} tamanhos adicionados na cor ${newColorName}!`);
    } else {
      toast.info("Todos esses tamanhos já estão na lista para essa cor.");
    }
  };

  const handleRemoveVariant = (id: string) => {
    if (variants.length <= 1) {
      return toast.error("O produto precisa de pelo menos uma variação com tamanho e cor.");
    }
    setVariants(variants.filter((v) => v.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nome do produto é obrigatório.");
    const priceNum = parseFloat(price.replace(",", "."));
    if (isNaN(priceNum) || priceNum <= 0)
      return toast.error("Informe um preço válido maior que zero.");
    if (variants.length === 0)
      return toast.error("Adicione pelo menos uma variação (tamanho/cor/estoque).");

    const finalImageKey = imageMode === "preset" ? imageKey : customImageUrl || imageKey;
    if (!finalImageKey) return toast.error("Selecione ou insira uma imagem para o produto.");

    setSaving(true);
    try {
      const productId = initialProduct?.id || `prod_${Date.now()}`;

      try {
        const prodPayload = {
          id: productId,
          name: name.trim(),
          category,
          price: priceNum,
          description: description.trim(),
          image_key: finalImageKey,
          active,
        };
        await supabase.from("products").upsert(prodPayload);

        for (const v of variants) {
          await supabase.from("product_variants").upsert({
            id: v.id.startsWith("v_") || v.id.startsWith("var_") ? undefined : v.id,
            product_id: productId,
            size: v.size,
            color: v.color,
            color_hex: v.color_hex,
            stock: v.stock,
          });
        }
      } catch (err) {
        console.warn("Aviso ao persistir no Supabase (fallback mock ativo):", err);
      }

      saveCustomProduct({
        id: productId,
        name: name.trim(),
        category,
        price: priceNum,
        description: description.trim(),
        image_key: finalImageKey,
        active,
        product_variants: variants.map((v) => ({ ...v, product_id: productId })),
      });

      toast.success(
        initialProduct ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!",
      );
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {initialProduct ? "Editar Produto" : "Adicionar Novo Produto"}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do produto, insira a foto da peça e configure as cores e tamanhos em
            estoque.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-xs uppercase tracking-wider font-semibold">
                Nome do Produto
              </Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Body Rendado Romântico"
                className="mt-1.5 rounded-none h-10"
              />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold">Categoria</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full h-10 border bg-background px-3 text-sm rounded-none focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold">
                Preço de Venda (R$)
              </Label>
              <Input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ex: 189.90"
                className="mt-1.5 rounded-none h-10 font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs uppercase tracking-wider font-semibold">
                Descrição da Peça
              </Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o tecido, detalhes em renda, modelagem e caimento..."
                className="mt-1.5 rounded-none text-sm resize-none"
              />
            </div>

            <div className="sm:col-span-2 flex items-center justify-between border p-3 bg-muted/20">
              <div>
                <p className="text-sm font-medium">Produto Ativo na Loja</p>
                <p className="text-xs text-muted-foreground">
                  Clientes poderão visualizar e comprar este item no site
                </p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          {/* INSERÇÃO DE IMAGEM */}
          <div className="border p-4 bg-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <span>Imagem do Produto</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Escolha como deseja inserir a foto da peça
                </p>
              </div>

              <div className="inline-flex rounded-none border p-0.5 bg-muted text-xs">
                <button
                  type="button"
                  onClick={() => setImageMode("upload")}
                  className={`px-3 py-1 font-medium transition ${
                    imageMode === "upload"
                      ? "bg-background shadow-xs text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Fazer Upload
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode("url")}
                  className={`px-3 py-1 font-medium transition ${
                    imageMode === "url"
                      ? "bg-background shadow-xs text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Link / URL
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode("preset")}
                  className={`px-3 py-1 font-medium transition ${
                    imageMode === "preset"
                      ? "bg-background shadow-xs text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Coleções
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="flex flex-col items-center">
                <div className="w-32 h-40 border bg-muted rounded-sm overflow-hidden relative shadow-inner">
                  <img
                    src={productImage(
                      imageMode === "preset" ? imageKey : customImageUrl || imageKey,
                    )}
                    alt="Pré-visualização do produto"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-[11px] text-muted-foreground mt-1.5">Preview na Loja</span>
              </div>

              <div className="sm:col-span-2 space-y-3">
                {imageMode === "upload" && (
                  <div className="space-y-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-sm p-4 text-center cursor-pointer hover:border-primary transition-colors bg-muted/30"
                    >
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs font-medium">
                        Clique para escolher uma imagem do seu computador ou celular
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Formatos JPG, PNG ou WEBP (até 5MB)
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    {customImageUrl && (
                      <p className="text-xs text-emerald-700 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Foto personalizada carregada!
                      </p>
                    )}
                  </div>
                )}

                {imageMode === "url" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Cole o link da foto (URL direta HTTPS):</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://images.unsplash.com/..."
                        value={customImageUrl}
                        onChange={(e) => setCustomImageUrl(e.target.value)}
                        className="rounded-none h-9 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (customImageUrl) setImageKey(customImageUrl);
                        }}
                        className="rounded-none h-9 text-xs"
                      >
                        Aplicar
                      </Button>
                    </div>
                  </div>
                )}

                {imageMode === "preset" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Ou selecione um editorial da Eliza Lingerie:</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.slug}
                          type="button"
                          onClick={() => setImageKey(c.slug)}
                          className={`p-1.5 text-left border rounded-sm flex items-center gap-2 transition ${
                            imageKey === c.slug
                              ? "border-primary bg-primary/10 font-medium"
                              : "hover:bg-muted"
                          }`}
                        >
                          <img src={c.image} alt="" className="h-7 w-7 rounded-full object-cover" />
                          <span className="text-[11px] truncate">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VARIAÇÕES */}
          <div className="border p-4 bg-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b pb-2">
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold">
                  Tamanhos, Cores e Estoque ({variants.length})
                </Label>
                <p className="text-xs text-muted-foreground">
                  Adicione as opções de compra que a cliente poderá selecionar
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                <span className="text-[11px] text-muted-foreground mr-1">Rápido:</span>
                <button
                  type="button"
                  onClick={() => handleQuickAddSizes(COMMON_SIZES_ADULT)}
                  className="text-[11px] underline hover:text-primary"
                >
                  + P/M/G/GG
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => handleQuickAddSizes(COMMON_SIZES_KIDS)}
                  className="text-[11px] underline hover:text-primary"
                >
                  + Infantil 4 a 12
                </button>
              </div>
            </div>

            <div className="bg-muted/40 p-3 rounded-sm space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-[11px]">Tamanho</Label>
                  <Input
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    placeholder="P, M, G, 6..."
                    className="h-8 rounded-none text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px]">Nome da Cor</Label>
                  <Input
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    placeholder="Rosé, Preto..."
                    className="h-8 rounded-none text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px]">Amostra da Cor</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={newColorHex}
                      onChange={(e) => setNewColorHex(e.target.value)}
                      className="h-8 w-10 border p-0.5 cursor-pointer bg-background"
                      title="Escolher cor personalizada"
                    />
                    <div className="flex gap-1 overflow-x-auto py-0.5">
                      {COLOR_PALETTE.map((pal) => (
                        <button
                          key={pal.name}
                          type="button"
                          title={pal.name}
                          onClick={() => {
                            setNewColorName(pal.name);
                            setNewColorHex(pal.hex);
                          }}
                          className="h-6 w-6 rounded-full border shrink-0 transition hover:scale-110"
                          style={{ backgroundColor: pal.hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-[11px]">Estoque (un.)</Label>
                  <div className="flex gap-1.5 mt-1">
                    <Input
                      type="number"
                      min="0"
                      value={newStock}
                      onChange={(e) => setNewStock(e.target.value)}
                      className="h-8 rounded-none text-xs w-20"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddVariant}
                      className="rounded-none h-8 px-2.5 text-xs flex-1 gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Adicionar</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto border p-2 rounded-sm bg-background">
              {variants.map((v, idx) => (
                <div
                  key={v.id || idx}
                  className="flex items-center justify-between p-2 text-xs border rounded-sm hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 rounded-full border shrink-0"
                      style={{ backgroundColor: v.color_hex }}
                    />
                    <span className="font-semibold text-foreground">Tam: {v.size}</span>
                    <span className="text-muted-foreground">— {v.color}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span>Estoque:</span>
                      <Input
                        type="number"
                        min="0"
                        value={v.stock}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          const updated = [...variants];
                          const item = updated[idx];
                          if (item) {
                            item.stock = val;
                            setVariants(updated);
                          }
                        }}
                        className="h-7 w-16 text-center rounded-none text-xs"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(v.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Remover variação"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {variants.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-4">
                  Nenhuma variação adicionada.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Salvando..." : initialProduct ? "Salvar Alterações" : "Cadastrar Produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="border bg-card p-4 sm:p-5">
      <p className="eyebrow text-muted-foreground text-xs">{label}</p>
      <p className={`mt-2 font-display text-2xl sm:text-3xl ${alert ? "text-destructive" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function StockCell({
  id,
  label,
  hex,
  stock,
}: {
  id: string;
  label: string;
  hex: string;
  stock: number;
}) {
  const qc = useQueryClient();
  const [val, setVal] = useState(String(stock));
  const save = async () => {
    const n = Math.max(0, parseInt(val) || 0);
    if (n === stock) return;
    try {
      await supabase.from("product_variants").update({ stock: n }).eq("id", id);
      toast.success("Estoque atualizado");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar estoque");
    }
  };
  return (
    <label
      className={`flex items-center gap-2 border p-2 text-xs bg-background ${
        stock <= 3 ? "border-destructive/80 bg-destructive/5" : ""
      }`}
    >
      <span className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: hex }} />
      <span className="flex-1 truncate">{label}</span>
      <Input
        className="h-7 w-14 px-1 text-center rounded-none"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
      />
    </label>
  );
}
