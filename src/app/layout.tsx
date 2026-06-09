import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TTB Label Verifier",
  description: "AI-assisted alcohol label compliance verification",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b-4 border-agency bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded bg-agency text-lg font-bold text-white">
                ✓
              </span>
              <span className="text-xl font-bold text-ink">
                TTB Label Verifier
              </span>
            </Link>
            <nav className="flex gap-2 text-base font-semibold">
              <Link
                href="/"
                className="rounded px-4 py-2 text-ink hover:bg-slate-100"
              >
                Single Label
              </Link>
              <Link
                href="/batch"
                className="rounded px-4 py-2 text-ink hover:bg-slate-100"
              >
                Batch
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-sm text-slate-500">
          Prototype — proof of concept only. Not connected to COLA. Final
          determinations are made by a human reviewer.
        </footer>
      </body>
    </html>
  );
}
