"use client";

import { SCENES, sceneDescriptor as d, type SceneId } from "@/labs/lens-and-framing/config";
import { labStore, useLab } from "@/ui/store/labStore";

/** Mirror the active scene into the URL (read-only deep link) without a navigation. */
function writeSceneParam(id: SceneId) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id === "doorway") url.searchParams.delete("scene");
  else url.searchParams.set("scene", id);
  window.history.replaceState(window.history.state, "", url);
}

/**
 * Three scenes share the camera rail and the cast; each teaches a different lens lesson.
 * A compact bar at the top centre of the stage, so the HUD column keeps its height.
 */
export function ScenePicker() {
  const sceneId = useLab((s) => s.ui.sceneId);
  return (
    <div data-ui className="lf-scenes" data-testid="scene-picker">
      <div role="radiogroup" aria-label="Scene" className="flex items-center gap-0.5">
        {SCENES.map((s) => {
          const on = s.scene.id === sceneId;
          return (
            <button
              key={s.scene.id}
              type="button"
              role="radio"
              aria-checked={on}
              data-testid={`scene-${s.scene.id}`}
              title={`${s.scene.logline} ${s.scene.tip}`}
              onClick={() => {
                labStore.getState().setScene(s.scene.id);
                writeSceneParam(s.scene.id);
              }}
              className="lf-scene-option"
            >
              {s.scene.title.replace(/^The /, "")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The intro line under the title: the generic lens lesson on the doorway, the scene's own lesson elsewhere. */
export function SceneLede() {
  const sceneId = useLab((s) => s.ui.sceneId);
  return (
    <p className="mt-2 max-w-[34em] text-[12.5px] leading-normal text-ink-1" data-testid="scene-tip">
      {sceneId === "doorway" ? (
        <>
          Change the lens and watch the shot. Then turn on <b className="text-ink-0">Match framing</b> and watch the camera move.
        </>
      ) : (
        d.scene.tip
      )}
    </p>
  );
}
