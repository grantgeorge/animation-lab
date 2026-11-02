import Link from "next/link";
import { LABS } from "@/labs/registry";
import { DISCIPLINES, type LabEntry } from "@/labs/types";

export default function Home() {
  const sorted = [...LABS].sort((a, b) => a.order - b.order);
  const availableLabs = sorted.filter((l) => l.status === "available");
  const concepts = sorted.filter((l) => l.status !== "available");
  const available = availableLabs[0];
  return (
    <main className="min-h-screen bg-void">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse at 30% 0%, rgb(95 227 255 / 0.08), transparent 55%), radial-gradient(ellipse at 90% 100%, rgb(255 181 71 / 0.06), transparent 50%)" }}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-16">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-1">Animation Lab</p>
        <h1 className="mt-3 max-w-3xl text-[44px] font-bold leading-[1.05] tracking-tight">
          An interactive school for <span className="text-focal-text">animated filmmaking</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-1">
          Move a virtual cinema camera through a miniature animated set and see the actual shot it makes. Learn what a lens really does, then use the same words to direct your shots and your AI video prompts.
        </p>
        <Link
          href={`/labs/${available.id}`}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#E9EEF4] px-5 py-2.5 text-[14px] font-semibold text-[#0B0E14] transition-colors hover:bg-[var(--color-distance)]"
          data-testid="open-lab"
        >
          Open {available.title} →
        </Link>
        <Link
          href="/history"
          className="ml-3 mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-[14px] font-semibold text-ink-0 transition-colors hover:bg-white/10"
          data-testid="open-history"
        >
          Animation History →
        </Link>

        {/* Labs grouped by discipline: built labs first, then the roadmap (docs/roadmap.md). */}
        {DISCIPLINES.map((d) => {
          const built = availableLabs.filter((l) => l.discipline === d.id);
          const planned = concepts.filter((l) => l.discipline === d.id);
          if (!built.length && !planned.length) return null;
          return (
            <section key={d.id} className="mt-14" data-testid={`discipline-${d.id}`}>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="micro">{d.title}</h2>
                <span className="text-[12.5px] text-ink-2">{d.blurb}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {built.map((l) => (
                  <AvailableCard key={l.id} lab={l} />
                ))}
                {planned.map((l) => (
                  <ConceptCard key={l.id} lab={l} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function AvailableCard({ lab }: { lab: LabEntry }) {
  return (
    <Link
      href={`/labs/${lab.id}`}
      className="glass group flex min-h-[220px] flex-col p-5 transition-transform hover:-translate-y-0.5"
      data-testid={`lab-card-${lab.id}`}
    >
      <span className="mono w-fit rounded-full bg-[rgb(142_240_195/0.14)] px-2 py-0.5 text-[10px] tracking-wider text-subject">AVAILABLE · {lab.minutes} MIN</span>
      <h3 className="mt-3 text-[20px] font-semibold">{lab.title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-1">{lab.description}</p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
        {lab.concepts.map((c) => (
          <span key={c} className="mono rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] text-ink-1">
            {c}
          </span>
        ))}
      </div>
    </Link>
  );
}

function ConceptCard({ lab }: { lab: LabEntry }) {
  const bg = lab.preview.kind === "gradient" ? `linear-gradient(135deg, ${lab.preview.from}, ${lab.preview.to})` : undefined;
  return (
    <div
      role="group"
      aria-disabled="true"
      aria-label={`${lab.title}: concept, not yet built`}
      className="relative flex min-h-[220px] cursor-not-allowed flex-col rounded-[14px] border border-dashed border-white/12 p-5 opacity-60"
      style={{ background: bg }}
      data-testid={`lab-card-${lab.id}`}
      title="Planned: not available yet"
    >
      <span className="mono w-fit rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] tracking-wider text-ink-2">CONCEPT · NOT YET BUILT</span>
      <h3 className="mt-3 text-[18px] font-semibold text-ink-1">{lab.title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{lab.description}</p>
    </div>
  );
}
