import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/catalog";
import { STATUS_LABEL, dateBR } from "@/lib/orders";
import { AddressFields, emptyAddress, type Address } from "@/components/AddressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — Eliza Lingerie" },
      { name: "description", content: "Seus dados, endereço e pedidos." },
      { property: "og:title", content: "Minha conta — Eliza Lingerie" },
      { property: "og:description", content: "Seus dados, endereço e pedidos." },
    ],
  }),
  component: Conta,
});

function Conta() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [info, setInfo] = useState({ full_name: "", cpf: "", phone: "" });
  const [addr, setAddr] = useState<Address>(emptyAddress);

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });
  const { data: orders } = useQuery({
    queryKey: ["my-orders", user.id],
    queryFn: async () =>
      (
        await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  useEffect(() => {
    if (!profile) return;
    setInfo({ full_name: profile.full_name, cpf: profile.cpf ?? "", phone: profile.phone ?? "" });
    setAddr({
      cep: profile.cep ?? "",
      street: profile.street ?? "",
      number: profile.number ?? "",
      complement: profile.complement ?? "",
      neighborhood: profile.neighborhood ?? "",
      city: profile.city ?? "",
      state: profile.state ?? "",
      delivery_notes: profile.delivery_notes ?? "",
    });
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...info, ...addr, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Dados salvos");
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-6 py-12 lg:grid-cols-2">
      <form onSubmit={save} className="space-y-6">
        <h1 className="text-5xl">Minha conta</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <div>
          <Label>Nome completo</Label>
          <Input
            value={info.full_name}
            onChange={(e) => setInfo({ ...info, full_name: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>CPF</Label>
            <Input value={info.cpf} onChange={(e) => setInfo({ ...info, cpf: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input
              value={info.phone}
              onChange={(e) => setInfo({ ...info, phone: e.target.value })}
            />
          </div>
        </div>
        <h2 className="text-2xl">Endereço de entrega</h2>
        <AddressFields value={addr} onChange={setAddr} />
        <Button type="submit" className="rounded-none eyebrow">
          Salvar dados
        </Button>
      </form>
      <div>
        <h2 className="text-3xl">Meus pedidos</h2>
        {!orders?.length ? (
          <p className="mt-4 text-muted-foreground">Você ainda não fez pedidos.</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {orders.map((o) => {
              const addr = (o.shipping_address as Record<string, string>) || {};
              const tracking = addr["tracking_code"];

              return (
                <li key={o.id} className="border bg-card p-4 sm:p-5 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-1">
                    <span className="text-muted-foreground font-mono">
                      #{o.id.slice(0, 8).toUpperCase()} · {dateBR(o.created_at)}
                    </span>
                    <span className="eyebrow text-xs font-semibold px-2 py-0.5 border w-fit bg-secondary/50">
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>

                  <ul className="mt-2 text-sm divide-y divide-dashed">
                    {o.order_items.map((i) => (
                      <li key={i.id} className="py-1 flex justify-between">
                        <span>
                          {i.quantity}× {i.product_name} ({i.size}, {i.color})
                        </span>
                        {i.unit_price && (
                          <span className="text-muted-foreground">
                            {brl(Number(i.unit_price) * i.quantity)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {tracking && (
                    <div className="flex items-center justify-between text-xs bg-primary/10 p-2.5 rounded-sm border border-primary/20">
                      <span className="font-mono text-primary font-semibold">
                        Código de Rastreio: {tracking}
                      </span>
                      <a
                        href={`https://rastreamento.correios.com.br/app/index.php?codigo=${tracking}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline font-medium hover:opacity-80"
                      >
                        Acompanhar Envio ↗
                      </a>
                    </div>
                  )}

                  <p className="mt-2 text-right font-medium text-base text-foreground">
                    Total: {brl(Number(o.total))}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
