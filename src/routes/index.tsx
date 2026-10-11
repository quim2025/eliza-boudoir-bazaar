import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/hero.jpg";
import { CATEGORIES } from "@/lib/catalog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eliza Lingerie — Lingerie, íntimas e pijamas" },
      {
        name: "description",
        content:
          "Lingerie, roupas íntimas e pijamas femininos e infantis com delicadeza e conforto.",
      },
      { property: "og:title", content: "Eliza Lingerie" },
      {
        property: "og:description",
        content: "Lingerie, roupas íntimas e pijamas femininos e infantis.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div>
      <section className="relative">
        <img
          src={hero}
          alt="Peças da coleção Eliza Lingerie"
          width={1600}
          height={1008}
          className="h-[78vh] w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/60 via-foreground/20 to-transparent" />
        <div className="absolute inset-0 mx-auto flex max-w-7xl flex-col justify-center px-6 text-primary-foreground">
          <p className="eyebrow">Nova coleção</p>
          <h1 className="mt-4 max-w-xl text-5xl leading-[1.05] md:text-7xl">
            Delicadeza que <em>abraça</em> você
          </h1>
          <p className="mt-5 max-w-md text-lg opacity-90">
            Rendas, algodão macio e cetim para todos os momentos — da mamãe às pequenas.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" variant="secondary" className="rounded-none px-10 eyebrow">
              <Link to="/loja">Ver a loja</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="eyebrow text-center text-muted-foreground">Categorias</p>
        <h2 className="mt-2 text-center text-4xl md:text-5xl">Encontre o seu estilo</h2>
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-5">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} to="/loja" search={{ categoria: c.slug }} className="group">
              <div className="overflow-hidden bg-muted">
                <img
                  src={c.image}
                  alt={c.label}
                  loading="lazy"
                  width={800}
                  height={1008}
                  className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <p className="mt-3 text-center font-display text-xl">{c.label}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
