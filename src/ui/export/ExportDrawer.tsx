"use client";

import { useEffect, useMemo, useRef } from "react";
import { useLab, labStore } from "@/ui/store/labStore";
import { labEvents } from "@/ui/store/events";
import { currentShotExport } from "./exportShot";

/** Read-only drawer with the shot settings JSON (Blender / Unreal ready), copy and download. */
export function ExportDrawer() {
  const open = useLab((s) => s.ui.exportOpen);
  const version = useLab((s) => s.camera.version);
  const x = useMemo(() => (open ? currentShotExport() : null), [open, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  const json = JSON.stringify(x, null, 2);
  const copy = async (text: string, kind: "json" | "phrase") => {
    try {
      await navigator.clipboard.writeText(text);
      labStore.getState().toast(kind === "json" ? "Copied shot settings JSON" : "Copied shot language");
      labEvents.emit({ type: "exportCopied", kind });
    } catch {
      labStore.getState().toast("Select the export text and copy it manually");
    }
  };
  const download = () => {
    if (!x) return;
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shot-${Math.round(x.lens.focalLengthMm)}mm-${x.classification.shotSize.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <dialog ref={dialog} onClose={() => labStore.getState().setExportOpen(false)} aria-labelledby="shot-export-title" className="fixed bottom-5 left-auto right-5 top-5 m-0 h-[calc(100dvh-40px)] w-[440px] max-w-[92vw] rounded-[14px] border border-white/10 bg-[rgb(12_16_26/0.97)] p-0 text-ink-0 shadow-[0_20px_60px_#000c] backdrop:bg-[#05070f80]" data-testid="export-drawer">
      {x && <div className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="shot-export-title" className="micro">Shot settings export</h2>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-0">{x.prompt.phrase}</p>
        </div>
        <button type="button" onClick={() => labStore.getState().setExportOpen(false)} className="text-xl text-ink-2 hover:text-ink-0" aria-label="Close export">
          ×
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-white/[0.05] px-2 py-1.5">
          <span className="micro text-[8.5px]">Blender</span>
          <p className="mono mt-0.5 text-ink-1">
            loc {x.engines.blender.location.map((v) => v.toFixed(2)).join(", ")}
            <br />
            rot {x.engines.blender.rotationEulerDeg.map((v) => v.toFixed(1)).join(", ")}° · {x.engines.blender.lensMm} mm
          </p>
        </div>
        <div className="rounded-md bg-white/[0.05] px-2 py-1.5">
          <span className="micro text-[8.5px]">Unreal</span>
          <p className="mono mt-0.5 text-ink-1">
            loc {x.engines.unreal.locationCm.map((v) => v.toFixed(0)).join(", ")} cm
            <br />
            P {x.engines.unreal.rotator.pitch.toFixed(1)} Y {x.engines.unreal.rotator.yaw.toFixed(1)} · {x.engines.unreal.currentFocalLengthMm} mm
          </p>
        </div>
      </div>
      <pre className="mono mt-3 min-h-0 flex-1 select-all overflow-auto rounded-md bg-black/40 p-2.5 text-[10.5px] leading-[1.5] text-ink-1" data-testid="export-json">
        {json}
      </pre>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => void copy(json, "json")} className="rounded-md bg-[#E9EEF4] px-3 py-1.5 text-[12px] font-semibold text-[#0B0E14]" data-testid="copy-json">
          Copy JSON
        </button>
        <button type="button" onClick={() => void copy(x.prompt.phrase, "phrase")} className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] text-ink-0">
          Copy shot language
        </button>
        <button type="button" onClick={download} className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] text-ink-0">
          Download .json
        </button>
      </div>
      </div>}
    </dialog>
  );
}
