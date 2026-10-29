import { Suspense } from "react";
import { sair } from "@/app/actions";
import { NavLinks } from "@/components/nav-links";
import { createClient } from "@/lib/supabase/server";

async function UsuarioRodape() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-1 border-t border-border p-3">
      <p className="truncate text-xs text-muted-foreground" title={user?.email}>
        {user?.email}
      </p>
      <form action={sair}>
        <button
          type="submit"
          className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-hover"
        >
          Sair
        </button>
      </form>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-border bg-sidebar">
        <div className="px-4 py-4 text-sm font-semibold">Inventário</div>
        <NavLinks />
        <div className="mt-auto">
          <Suspense fallback={<div className="h-[73px] border-t border-border" />}>
            <UsuarioRodape />
          </Suspense>
        </div>
      </aside>
      <div className="ml-60 flex-1">
        <main className="mx-auto max-w-[960px] px-8 pt-12 pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
