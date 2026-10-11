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
      </form>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">ou cadastre-se com</span>
        </div>
      </div>

      <Button
        variant="outline"
        size="lg"
        onClick={async () => {
          try {
            const { data, error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: window.location.origin },
            });
            if (error) {
              toast.error(
                error.message.includes("OAuth secret")
                  ? "Configuração do Google no Supabase pendente. Use o formulário de cadastro acima."
                  : error.message,
              );
            } else if (data?.url) {
              window.location.href = data.url;
            }
          } catch {
            toast.error("Não foi possível conectar com o Google no momento.");
          }
        }}
        className="w-full rounded-none flex items-center justify-center gap-2"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        Continuar com Google
      </Button>

      <p className="mt-8 text-center text-sm">
        Já tem conta?{" "}
        <Link to="/auth" className="text-primary underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
