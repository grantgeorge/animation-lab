"use client";

import { useLab } from "@/ui/store/labStore";

export function Toasts() {
  const toasts = useLab((s) => s.ui.toasts);
  return (
    <div className="pointer-events-none absolute left-1/2 top-5 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] text-ink-0" data-testid="toast">
          {t.key && <kbd className="mono rounded bg-white/10 px-1.5 text-[10.5px] text-ink-1">{t.key}</kbd>}
          {t.text}
        </div>
      ))}
    </div>
  );
}
