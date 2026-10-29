"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MapPin,
  Package,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/itens", label: "Itens", icon: Package },
  { href: "/locais", label: "Locais", icon: MapPin },
  { href: "/categorias", label: "Categorias", icon: Tags },
  { href: "/pessoas", label: "Pessoas", icon: Users },
];

// Em rotas com parâmetro dinâmico (/itens/[id]) o pathname só existe na
// requisição; o fallback mantém os links no shell estático, sem destaque.
export function NavLinks() {
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <LinksComDestaque />
    </Suspense>
  );
}

function LinksComDestaque() {
  return <Links pathname={usePathname()} />;
}

function Links({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          pathname !== null &&
          (href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-hover",
              active
                ? "bg-surface-hover text-foreground"
                : "text-foreground",
            )}
          >
            <Icon size={16} className="text-muted-foreground" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
