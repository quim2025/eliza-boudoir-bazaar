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

  const [oauthLoading, setOauthLoading] = useState(false);

  const google = async () => {
    setOauthLoading(true);
    try {
      // 1. Try Lovable Cloud OAuth first
      const r = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (r && !r.error) {
        toast.success("Autenticado com sucesso!");
        navigate({ to: "/loja" });
        return;
      }

      // 2. If lovable.auth returns an error or fails, fallback to direct Supabase OAuth
      console.warn(
        "[Auth] Lovable OAuth returned error, trying direct Supabase OAuth...",
        r?.error,
      );
      const { data, error: supaErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (supaErr) {
        console.error("[Auth] Supabase OAuth error:", supaErr);
        toast.error(
          supaErr.message?.includes("OAuth secret")
            ? "O login do Google precisa ter o Client ID configurado no painel do Supabase/Lovable. Use seu e-mail e senha cadastrados ou o acesso rápido."
            : `Erro ao conectar com Google: ${supaErr.message}`,
        );
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("[Auth] Unexpected OAuth error:", err);
      toast.error("Não foi possível concluir o login com Google.");
    } finally {
      setOauthLoading(false);
    }
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
      <Button
        variant="outline"
        size="lg"
        onClick={google}
        disabled={oauthLoading || loading}
        className="mt-3 w-full rounded-none flex items-center justify-center gap-2"
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
        {oauthLoading ? "Conectando ao Google…" : "Continuar com Google"}
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
