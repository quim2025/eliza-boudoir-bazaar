import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressFields, emptyAddress, type Address } from "@/components/AddressFields";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Eliza Lingerie" },
      { name: "description", content: "Crie sua conta com seus dados e endereço de entrega." },
      { property: "og:title", content: "Criar conta — Eliza Lingerie" },
      {
        property: "og:description",
        content: "Crie sua conta com seus dados e endereço de entrega.",
      },
    ],
  }),
  component: Cadastro,
});

function Cadastro() {
  const [form, setForm] = useState({ full_name: "", cpf: "", phone: "", email: "", password: "" });
  const [addr, setAddr] = useState<Address>(emptyAddress);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("A senha precisa ter ao menos 6 caracteres");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: form.full_name, cpf: form.cpf, phone: form.phone, ...addr },
      },
    });
    setLoading(false);
    if (error)
      return toast.error(
        error.message.includes("registered") ? "Este e-mail já está cadastrado" : error.message,
      );
    setDone(true);
  };

  if (done)
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-4xl">Confirme seu e-mail</h1>
        <p className="mt-4 text-muted-foreground">
          Enviamos um link para <strong>{form.email}</strong>. Clique nele para ativar sua conta.
        </p>
        <Button asChild className="mt-8 rounded-none eyebrow">
          <Link to="/auth">Ir para o login</Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-center text-5xl">Criar conta</h1>
      <form onSubmit={submit} className="mt-10 space-y-10">
        <section className="space-y-4">
          <h2 className="text-2xl">Dados pessoais</h2>
          <div>
            <Label>Nome completo</Label>
            <Input
              required
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>CPF</Label>
              <Input
                required
                value={form.cpf}
                onChange={(e) => set("cpf", e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <Label>Telefone / WhatsApp</Label>
              <Input
                required
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(11) 90000-0000"
              />
            </div>
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl">Endereço de entrega</h2>
          <AddressFields value={addr} onChange={setAddr} />
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl">Acesso</h2>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <Label>Senha</Label>
            <Input
              type="password"
              required
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>
        </section>
        <Button type="submit" size="lg" disabled={loading} className="w-full rounded-none eyebrow">
          {loading ? "Criando…" : "Criar minha conta"}
        </Button>
        <p className="text-center text-sm">
          Já tem conta?{" "}
          <Link to="/auth" className="text-primary underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
