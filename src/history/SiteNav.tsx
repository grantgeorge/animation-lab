import Link from "next/link";

/** Shared top navigation: AI Explainer (the labs) and Animation History as siblings. */
export function SiteNav({ current }: { current: "explainer" | "history" }) {
  const item = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? "bg-white/10 text-ink-0" : "text-ink-1 hover:text-ink-0"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {item("/", "AI Explainer", current === "explainer")}
      {item("/history", "Animation History", current === "history")}
    </nav>
  );
}
