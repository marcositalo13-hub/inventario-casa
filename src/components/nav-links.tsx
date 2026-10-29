"use client";

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

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
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
