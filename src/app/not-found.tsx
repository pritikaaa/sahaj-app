import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="space-y-3 py-10 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-muted-foreground text-sm">That page or record doesn&apos;t exist.</p>
      <Button asChild><Link href="/">Go home</Link></Button>
    </div>
  );
}
