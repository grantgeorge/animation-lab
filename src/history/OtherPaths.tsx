import Link from "next/link";
import { SOURCES } from "./content/sources";

const CARDS = [
  { title: "Digital 2D today", body: "Reusable 2D rigs and animatics still power expressive, drawn-looking series.", sourceId: "bluey" },
  { title: "Stop-motion and digital tools", body: "Physical puppets now use digitally designed, 3D-printed faces and visual effects.", sourceId: "laika" },
  { title: "Real-time filmmaking", body: "Game-engine previews shorten the feedback loop, a workflow branch rather than a style. Try moving a live camera in the lab.", sourceId: "bluezoo-rt", href: "/labs/lens-and-framing", cta: "Open the live set →" },
  { title: "Lens and framing", body: "Camera position and focal length solve different problems, in every method on this page.", href: "/labs/lens-and-framing", cta: "Open Lens & Framing →" },
] as { title: string; body: string; sourceId?: string; href?: string; cta?: string }[];

export function OtherPaths() {
  return (
    <section aria-labelledby="other-paths" className="mt-12">
      <h2 id="other-paths" className="micro mb-3">
        Other paths continue
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <div key={c.title} className="rounded-[var(--radius-panel)] border border-white/[0.07] bg-white/[0.025] p-4">
            <h3 className="text-[14px] font-semibold">{c.title}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-1">{c.body}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {c.href && (
                <Link href={c.href} className="text-[12px] font-medium text-focal-text hover:underline">
                  {c.cta}
                </Link>
              )}
              {c.sourceId && (
                <a href={SOURCES[c.sourceId].url} target="_blank" rel="noreferrer" className="text-[11.5px] text-ink-2 underline-offset-2 hover:text-ink-1 hover:underline">
                  Source: {SOURCES[c.sourceId].publisher}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 max-w-3xl text-[11.5px] leading-relaxed text-ink-3">
        Historical-looking examples on this page are AI recreations made from a frame of the Lens &amp; Framing lab, not archival footage. Interactive demonstrations are authored from the lab&apos;s
        performance data and are labeled as simplified models. Film titles are cited for history only.
      </p>
    </section>
  );
}
