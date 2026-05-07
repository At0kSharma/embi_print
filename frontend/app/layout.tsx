import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartSheet } from "@/components/cart/CartSheet";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "embi_print — custom apparel, on demand",
  description:
    "Tees, hoodies, jackets, caps. Upload a logo, customize the placement, made to order and shipped in days.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <CartProvider>
          {children}
          <CartSheet />
        </CartProvider>
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
