import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brl, categoryLabel } from "@/lib/catalog";
import { ORDER_STATUSES, PAYMENT_LABEL, STATUS_LABEL, dateBR } from "@/lib/orders";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel Admin — Eliza Lingerie" },
      { name: "description", content: "Gestão de estoque, pedidos e clientes." },
      { property: "og:title", content: "Painel Admin — Eliza Lingerie" },
      { property: "og:description", content: "Gestão de estoque, pedidos e clientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { isAdmin, loading } = useAuth();
  if (loading)
    return <p className="mx-auto max-w-7xl px-6 py-12 text-muted-foreground">Carregando…</p>;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-4xl">Acesso restrito</h1>
        <p className="mt-3 text-muted-foreground">Esta área é exclusiva das proprietárias.</p>
        <Link to="/" className="mt-6 inline-block underline">
          Voltar
        </Link>
      </div>
    );
  return <AdminPanel />;
}

function AdminPanel() {
  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () =>
      (
        await supabase
          .from("orders")
          .select("*, order_items(*)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () =>
      (await supabase.from("products").select("*, product_variants(*)").order("category")).data ??
      [],
  });
  const { data: customers } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });

  const revenue = (orders ?? [])
    .filter((o) => o.status !== "cancelado" && o.status !== "pendente")
    .reduce((s, o) => s + Number(o.total), 0);
  const lowStock = (products ?? [])
    .flatMap((p) => p.product_variants)
    .filter((v) => v.stock <= 3).length;
  const customerName = (id: string) => customers?.find((c) => c.id === id)?.full_name || "—";

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <p className="eyebrow text-muted-foreground">Área das proprietárias</p>
      <h1 className="text-5xl">Painel</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Pedidos" value={String(orders?.length ?? 0)} />
        <Stat label="Faturamento" value={brl(revenue)} />
        <Stat label="Clientes" value={String(customers?.length ?? 0)} />
        <Stat label="Estoque baixo" value={String(lowStock)} alert={lowStock > 0} />
      </div>

      <Tabs defaultValue="pedidos" className="mt-10">
        <TabsList>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="mt-6">
          <div className="overflow-x-auto border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left eyebrow">
                <tr>
                  <th className="p-3">Pedido</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Itens</th>
                  <th className="p-3">Pagamento</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders?.map((o) => {
                  const a = o.shipping_address as Record<string, string>;
                  return (
                    <tr key={o.id} className="border-t align-top">
                      <td className="p-3">
                        #{o.id.slice(0, 8).toUpperCase()}
                        <div className="text-xs text-muted-foreground">{dateBR(o.created_at)}</div>
                      </td>
                      <td className="p-3">
                        {a.recipient || customerName(o.user_id)}
                        <div className="text-xs text-muted-foreground">
                          {a.phone}
                          <br />
                          {a.street}, {a.number} — {a.city}/{a.state}
                        </div>
                      </td>
                      <td className="p-3">
                        {o.order_items.map((i) => (
                          <div key={i.id}>
                            {i.quantity}× {i.product_name} ({i.size}, {i.color})
                          </div>
                        ))}
                      </td>
                      <td className="p-3">
                        {o.payment_method}
                        <div className="text-xs text-muted-foreground">
                          {PAYMENT_LABEL[o.payment_status] ?? o.payment_status}
                        </div>
                      </td>
                      <td className="p-3">{brl(Number(o.total))}</td>
                      <td className="p-3">
                        <StatusSelect id={o.id} value={o.status} />
                      </td>
                    </tr>
                  );
                })}
                {!orders?.length && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Nenhum pedido ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="estoque" className="mt-6 space-y-6">
          {products?.map((p) => (
            <div key={p.id} className="border bg-card p-5">
              <div className="flex justify-between">
                <div>
                  <p className="font-display text-xl">{p.name}</p>
                  <p className="eyebrow text-muted-foreground">
                    {categoryLabel(p.category)} · {brl(Number(p.price))}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total: {p.product_variants.reduce((s, v) => s + v.stock, 0)} un.
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {p.product_variants
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

        <TabsContent value="clientes" className="mt-6">
          <div className="overflow-x-auto border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left eyebrow">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Telefone</th>
                  <th className="p-3">CPF</th>
                  <th className="p-3">Endereço</th>
                  <th className="p-3">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {customers?.map((c) => (
                  <tr key={c.id} className="border-t align-top">
                    <td className="p-3">
                      {c.full_name || "—"}
                      <div className="text-xs text-muted-foreground">
                        desde {dateBR(c.created_at)}
                      </div>
                    </td>
                    <td className="p-3">
                      {c.phone ? (
                        <a
                          className="underline"
                          href={`https://wa.me/55${c.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {c.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">{c.cpf || "—"}</td>
                    <td className="p-3">
                      {c.street
                        ? `${c.street}, ${c.number} — ${c.neighborhood}, ${c.city}/${c.state} · CEP ${c.cep}`
                        : "—"}
                      {c.delivery_notes && (
                        <div className="text-xs text-muted-foreground">{c.delivery_notes}</div>
                      )}
                    </td>
                    <td className="p-3">{orders?.filter((o) => o.user_id === c.id).length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="border bg-card p-5">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl ${alert ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function StatusSelect({ id, value }: { id: string; value: string }) {
  const qc = useQueryClient();
  return (
    <select
      className="h-8 border bg-background px-2"
      value={value}
      onChange={async (e) => {
        const { error } = await supabase
          .from("orders")
          .update({ status: e.target.value })
          .eq("id", id);
        if (error) return toast.error(error.message);
        toast.success("Status atualizado");
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      }}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
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
    const { error } = await supabase.from("product_variants").update({ stock: n }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Estoque atualizado");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };
  return (
    <label
      className={`flex items-center gap-2 border p-2 text-xs ${stock <= 3 ? "border-destructive" : ""}`}
    >
      <span className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: hex }} />
      <span className="flex-1">{label}</span>
      <Input
        className="h-7 w-14 px-1 text-center"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
      />
    </label>
  );
}
