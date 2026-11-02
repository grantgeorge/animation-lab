import Link from "next/link";
import { availableLabs } from "@/labs/registry";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-void px-6" data-testid="not-found">
      <div className="max-w-md text-center">
        <p className="micro">404</p>
        <h1 className="mt-2 text-[28px] font-bold tracking-tight">That lab isn&apos;t built yet</h1>
        <p className="mt-2 text-[14px] text-ink-1">Only these labs are open right now:</p>
        <ul className="mt-4 space-y-2">
          {availableLabs().map((l) => (
            <li key={l.id}>
              <Link href={`/labs/${l.id}`} className="text-focal-text underline-offset-4 hover:underline">
                {l.title} →
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/" className="mt-8 inline-block text-[13px] text-ink-2 hover:text-ink-0">
          Back to Animation Lab
        </Link>
      </div>
    </main>
  );
}
