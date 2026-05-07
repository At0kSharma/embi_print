import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { NewProductForm } from "./NewProductForm";

export default function NewProductPage() {
  return (
    <div className="container max-w-2xl py-8 md:py-10">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> All products
      </Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">New product</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        After saving, add variants (color × size), placement zones, and mockup
        images on the next screen.
      </p>
      <NewProductForm />
    </div>
  );
}
