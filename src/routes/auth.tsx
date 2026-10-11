import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Eliza Lingerie" },
      { name: "description", content: "Acesse sua conta Eliza Lingerie." },
      { property: "og:title", content: "Entrar — Eliza Lingerie" },
      { property: "og:description", content: "Acesse sua conta Eliza Lingerie." },
    ],
  }),
  component: Entrar,
});

function Entrar() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error)
      return toast.error(
        error.message.includes("Invalid")
          ? "E-mail ou senha incorretos"
          : error.message.includes("confirm")
            ? "Confirme seu e-mail antes de entrar"
            : error.message,
      );
    toast.success("Bem-vinda de volta!");
    navigate({ to: "/loja" });
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) toast.error("Não foi possível entrar com Google");
  };

  const forgot = async () => {
    if (!email) return toast.error("Digite seu e-mail acima");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link de recuperação para seu e-mail");
  };

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-center text-5xl">Entrar</h1>
      <p className="mt-2 text-center text-muted-foreground">
        Acesse sua conta para finalizar compras e acompanhar pedidos.
      </p>
      <form onSubmit={submit} className="mt-10 space-y-4">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={forgot}
          className="text-sm text-muted-foreground underline hover:text-primary"
        >
          Esqueci minha senha
        </button>
        <Button type="submit" size="lg" disabled={loading} className="w-full rounded-none eyebrow">
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <Button variant="outline" size="lg" onClick={google} className="mt-3 w-full rounded-none">
        Continuar com Google
      </Button>
      <p className="mt-8 text-center text-sm">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="text-primary underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
