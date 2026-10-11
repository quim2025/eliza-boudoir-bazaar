import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, User, LogOut, LayoutDashboard } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/catalog";

export function SiteHeader() {
  const { count } = useCart();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="bg-primary py-1.5 text-center text-primary-foreground eyebrow">
        Frete grátis acima de R$ 299
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-display text-2xl tracking-wide md:text-3xl">
          Eliza <span className="italic text-primary">Lingerie</span>
        </Link>
        <nav className="hidden gap-6 lg:flex">
          <Link
            to="/loja"
            className="eyebrow hover:text-primary"
            activeOptions={{ includeSearch: false }}
          >
            Loja
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/loja"
              search={{ categoria: c.slug }}
              className="eyebrow hover:text-primary"
            >
              {c.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link to="/admin" title="Painel admin" className="hover:text-primary">
              <LayoutDashboard className="h-5 w-5" />
            </Link>
          )}
          {user ? (
            <>
              <Link to="/conta" title="Minha conta" className="hover:text-primary">
                <User className="h-5 w-5" />
              </Link>
              <button
                title="Sair"
                className="hover:text-primary"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/", replace: true });
                }}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="eyebrow hover:text-primary">
              Entrar
            </Link>
          )}
          <Link to="/carrinho" className="relative hover:text-primary" title="Carrinho">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-secondary/50">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl">
            Eliza <span className="italic text-primary">Lingerie</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Delicadeza e conforto para mulheres e meninas.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="eyebrow mb-3 text-foreground">Categorias</p>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/loja"
              search={{ categoria: c.slug }}
              className="block py-0.5 hover:text-primary"
            >
              {c.label}
            </Link>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="eyebrow mb-3 text-foreground">Atendimento</p>
          <p>Seg a Sex, 9h às 18h</p>
          <p>contato@elizalingerie.com.br</p>
        </div>
      </div>
    </footer>
  );
}
