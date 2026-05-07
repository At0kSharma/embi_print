import { Boxes, Package, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/ThemeToggle";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-muted/20">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 max-w-6xl items-center justify-between gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <span className="inline-block h-5 w-5 rounded-sm bg-primary" />
            <span>embi_print</span>
            <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background">
              admin
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Boxes className="h-4 w-4" /> Products
            </Link>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ShoppingBag className="h-4 w-4" /> Orders
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Package className="h-4 w-4" /> Storefront
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
