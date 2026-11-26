import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-4 flex flex-wrap items-center justify-between gap-x-16 gap-y-2 py-10 sm:mx-8 lg:mx-20">
      <Link href="/" className="text-primary text-3xl font-bold tracking-tight">sahaj</Link>
      <p className="text-muted-foreground text-sm">Pokhara, Nepal</p>
    </footer>
  );
}
