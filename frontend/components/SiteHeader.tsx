import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { CartButton } from "@/components/cart/CartButton";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Props {
  back?: { href: string; label: string };
}

export function SiteHeader({ back }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-6xl items-center justify-between gap-4">
        {back ? (
          <Link
            href={back.href}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {back.label}
          </Link>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <span className="inline-block h-5 w-5 rounded-sm bg-primary" />
            embi_print
          </Link>
        )}

        <div className="flex items-center gap-1">
          {back && (
            <Link
              href="/"
              className="mr-2 hidden items-center gap-2 text-sm font-semibold tracking-tight md:inline-flex"
            >
              <span className="inline-block h-4 w-4 rounded-sm bg-primary" />
              embi_print
            </Link>
          )}
          <ThemeToggle />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
