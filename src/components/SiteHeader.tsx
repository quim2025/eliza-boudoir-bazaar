import { Link, useNavigate } from "@tanstack/react-router";
import {
  ShoppingBag,
  User,
  LogOut,
  LayoutDashboard,
  Menu,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/catalog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function SiteHeader() {
  const { count } = useCart();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="bg-primary py-1.5 px-3 text-center text-primary-foreground text-xs font-light tracking-widest uppercase">
        Frete grátis para todo o Brasil acima de R$ 299
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
        {/* Mobile Hamburger Drawer */}
        <div className="flex items-center gap-2 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-sm hover:bg-muted focus:outline-none"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[85vw] max-w-sm p-0 flex flex-col justify-between"
            >
              <div className="p-6">
                <SheetHeader className="text-left border-b pb-4">
                  <SheetTitle className="font-display text-2xl">
                    Eliza <span className="italic text-primary">Lingerie</span>
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground">Delicadeza que abraça você</p>
                </SheetHeader>

                <div className="mt-6 space-y-5">
                  <div>
                    <p className="eyebrow text-muted-foreground mb-3">Navegação</p>
                    <Link
                      to="/loja"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-between py-2 text-base font-normal hover:text-primary border-b"
                    >
                      <span>Ver Toda a Loja</span>
                      <Sparkles className="h-4 w-4 text-primary" />
                    </Link>
                  </div>

                  <div>
                    <p className="eyebrow text-muted-foreground mb-3">Categorias</p>
                    <div className="space-y-1.5">
                      {CATEGORIES.map((c) => (
                        <Link
                          key={c.slug}
                          to="/loja"
                          search={{ categoria: c.slug }}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3 p-2 rounded-sm hover:bg-muted transition-colors"
                        >
                          <img
                            src={c.image}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover border"
                          />
                          <span className="text-sm font-medium">{c.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <p className="eyebrow text-muted-foreground mb-2">Sua Conta</p>
                    {user ? (
                      <>
                        <Link
                          to="/conta"
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3 py-2 text-sm hover:text-primary"
                        >
                          <User className="h-4 w-4" />
                          <span>Meus Pedidos & Perfil</span>
                        </Link>
                        {isAdmin && (
                          <Link
                            to="/admin"
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-3 py-2 text-sm text-primary font-medium hover:underline"
                          >
                            <LayoutDashboard className="h-4 w-4" />
                            <span>Painel das Proprietárias</span>
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            setMobileOpen(false);
                            await supabase.auth.signOut();
                            navigate({ to: "/", replace: true });
                          }}
                          className="flex w-full items-center gap-3 py-2 text-sm text-destructive hover:opacity-80"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sair da conta</span>
                        </button>
                      </>
                    ) : (
                      <Link
                        to="/auth"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 py-2 text-sm text-primary font-medium"
                      >
                        <User className="h-4 w-4" />
                        <span>Entrar ou Criar Conta</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer footer */}
              <div className="p-6 border-t bg-secondary/30 text-xs text-muted-foreground">
                <a
                  href="https://wa.me/5511999999999"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-foreground font-medium mb-1 hover:text-primary"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  <span>Atendimento via WhatsApp</span>
                </a>
                <p>Seg a Sex, 9h às 18h</p>
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/" className="font-display text-2xl tracking-wide">
            Eliza <span className="italic text-primary">Lingerie</span>
          </Link>
        </div>

        {/* Desktop Brand */}
        <div className="hidden lg:block">
          <Link to="/" className="font-display text-2xl tracking-wide md:text-3xl">
            Eliza <span className="italic text-primary">Lingerie</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden gap-6 lg:flex">
          <Link
            to="/loja"
            className="eyebrow hover:text-primary transition-colors"
            activeOptions={{ includeSearch: false }}
          >
            Loja
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/loja"
              search={{ categoria: c.slug }}
              className="eyebrow hover:text-primary transition-colors"
            >
              {c.label}
            </Link>
          ))}
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {isAdmin && (
            <Link
              to="/admin"
              title="Painel admin"
              className="flex h-9 w-9 items-center justify-center rounded-sm hover:bg-muted hover:text-primary transition-colors"
            >
              <LayoutDashboard className="h-5 w-5" />
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-1">
              <Link
                to="/conta"
                title="Minha conta"
                className="flex h-9 w-9 items-center justify-center rounded-sm hover:bg-muted hover:text-primary transition-colors"
              >
                <User className="h-5 w-5" />
              </Link>
              <button
                title="Sair"
                className="hidden sm:flex h-9 w-9 items-center justify-center rounded-sm hover:bg-muted hover:text-primary transition-colors"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/", replace: true });
                }}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="hidden sm:inline-block eyebrow hover:text-primary transition-colors"
            >
              Entrar
            </Link>
          )}

          <Link
            to="/carrinho"
            className="relative flex h-10 w-10 items-center justify-center rounded-sm hover:bg-muted hover:text-primary transition-colors"
            title="Carrinho de compras"
            aria-label="Carrinho"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute 1 right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground animate-in zoom-in-50">
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
