import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Eliza Lingerie" },
      { name: "description", content: "Defina uma nova senha para sua conta." },
      { property: "og:title", content: "Nova senha — Eliza Lingerie" },
      { property: "og:description", content: "Defina uma nova senha para sua conta." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada!");
    navigate({ to: "/loja" });
  };
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 px-6 py-16">
      <h1 className="text-4xl">Defina sua nova senha</h1>
      <div><Label>Nova senha</Label><Input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <Button type="submit" className="w-full rounded-none eyebrow">Salvar</Button>
    </form>
  );
}
