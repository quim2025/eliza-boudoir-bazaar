import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
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
import { sendOrderStatusEmail } from "@/lib/integrations.functions";
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

function AdminPanel() {
  const qc = useQueryClient();
  const sendEmailFn = useServerFn(sendOrderStatusEmail);

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
        return res.data ?? [];
      } catch {
        return [];
      }
    },
  });

  // Dialog States
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

  // Search & Filters for Products
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");

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
    // CRITICAL per user requirement:
    // "o campo de rastreio da caixa de email padrão não deve ser preenchido pois o administrador preencherá com o rastreio fornecido pela transportadora"
    // Starts blank!
    setEmailTrackingCode("");
    setEmailModalOpen(true);
  };

  // Handler to confirm status and send email
  const handleConfirmStatusAndSendEmail = async () => {
    if (!selectedOrderForEmail) return;
    setEmailSending(true);

    const addr = (selectedOrderForEmail.shipping_address as Record<string, string>) || {};
    const recipientName =
      addr["recipient"] || customerName(selectedOrderForEmail.user_id) || "Cliente";
    const recipientPhone = addr["phone"] || "";

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
      // 1. Dispatch email server function
      await sendEmailFn({
        data: {
          orderId: selectedOrderForEmail.id,
          status: emailTargetStatus,
          trackingCode: emailTrackingCode.trim(),
          customerName: recipientName,
          customerEmail:
            addr["email"] || `cliente_${selectedOrderForEmail.id.slice(0, 5)}@email.com`,
          subject: emailDetails.subject,
          content: emailDetails.body,
        },
      });

      // 2. Update Supabase order status & tracking
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
      <Tabs defaultValue="produtos" className="mt-10">
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-muted/60 border rounded-none">
          <TabsTrigger value="produtos" className="rounded-none px-4 py-2 font-medium">
            Catálogo & CRUD
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="rounded-none px-4 py-2 font-medium">
            Pedidos & Rastreio ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="estoque" className="rounded-none px-4 py-2 font-medium">
            Estoque Rápido
          </TabsTrigger>
          <TabsTrigger value="clientes" className="rounded-none px-4 py-2 font-medium">
            Clientes ({customers.length})
          </TabsTrigger>
        </TabsList>

        {/* ----------------- TAB: PRODUTOS (CRUD) ----------------- */}
        <TabsContent value="produtos" className="mt-6 space-y-6">
          {/* Controls Bar */}
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
                  const colors = Array.from(
                    new Map(variants.map((v) => [v.color, v.color_hex])).entries(),
                  );

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

        {/* ----------------- TAB: PEDIDOS & RASTREIO ----------------- */}
        <TabsContent value="pedidos" className="mt-6 space-y-4">
          <div className="border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium text-foreground">Gestão de Pedidos & Envio de E-mails</p>
              <p className="text-xs text-muted-foreground">
                Ao alterar o status para &quot;Enviado&quot; ou qualquer outro, você pode inserir o
                código de rastreio e disparar o e-mail de notificação para o cliente.
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
                  <th className="p-3 text-right">Ação / E-mail</th>
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
                      <td className="p-3">
                        <p className="font-medium text-foreground">{cName}</p>
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-0.5">
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
                            // Prompt with email dialog
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEmailModal(o)}
                          className="rounded-none h-8 px-2.5 gap-1.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span>Notificar Cliente</span>
                        </Button>
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
                    <p className="font-medium text-foreground">{cName}</p>
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
        <TabsContent value="clientes" className="mt-6">
          <div className="overflow-x-auto border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left eyebrow border-b">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Telefone</th>
                  <th className="p-3">CPF</th>
                  <th className="p-3">Endereço</th>
                  <th className="p-3 text-right">Pedidos</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <p className="font-medium text-foreground">{c.full_name || "—"}</p>
                      <div className="text-xs text-muted-foreground">
                        Cadastrado desde {dateBR(c.created_at)}
                      </div>
                    </td>
                    <td className="p-3">
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
                    <td className="p-3 text-muted-foreground">{c.cpf || "—"}</td>
                    <td className="p-3 text-xs max-w-xs">
                      {c.street ? (
                        <div>
                          {c.street}, {c.number} — {c.neighborhood}, {c.city}/{c.state} · CEP{" "}
                          {c.cep}
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
                    <td className="p-3 text-right font-medium">
                      {orders.filter((o) => o.user_id === c.id).length}
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Nenhum cliente cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
              {/* Status Selector */}
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

                {/* TRACKING CODE: Starts completely empty as requested */}
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

              {/* LIVE EMAIL PREVIEW */}
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
    </div>
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
      // Default variants for new product
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

  // Sync whenever dialog opens or initialProduct changes
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    syncFromProduct(initialProduct);
  }
  prevOpenRef.current = open;

  // Handle image file upload
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

  // Add a variant
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

  // Quick add multiple sizes
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

  // Remove variant
  const handleRemoveVariant = (id: string) => {
    if (variants.length <= 1) {
      return toast.error("O produto precisa de pelo menos uma variação com tamanho e cor.");
    }
    setVariants(variants.filter((v) => v.id !== id));
  };

  // Save Product
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

      // 1. Save to Supabase if connected
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

        // Upsert variants
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

      // 2. Always persist locally so state updates seamlessly
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
          {/* Dados Básicos */}
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

          {/* ============================================================== */}
          {/* OPÇÃO DE INSERIR IMAGEM DO PRODUTO (Upload, URL ou Coleção)     */}
          {/* ============================================================== */}
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

              {/* Botões seletores de modo */}
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
              {/* Preview da Imagem */}
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

              {/* Opções conforme o modo */}
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

          {/* ============================================================== */}
          {/* VARIAÇÕES: TAMANHOS, CORES E ESTOQUE                          */}
          {/* ============================================================== */}
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

              {/* Botões rápidos de tamanhos */}
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

            {/* Inputs para nova variação */}
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

            {/* Lista de variações adicionadas */}
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

// Estatística Simples
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

// Célula de Estoque Rápido
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
