"use client";

import { EXERCISES, OBJECTIVES, exerciseById } from "../exercises";
import { exitExercise, restoreShot, saveShot, setObjective, startExercise } from "../LessonEngine";
import { lessonStore, useLesson, type ObjectiveId } from "../lessonStore";

export function LessonCard() {
  const s = useLesson((x) => x);
  const doneCount = EXERCISES.filter((e) => s.completed[e.id]).length;
  if (!s.active) {
    return (
      <div className="glass mt-3 max-w-[380px] px-3 py-2" data-testid="lesson-card">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          aria-expanded={s.cardOpen}
          onClick={() => lessonStore.setState({ cardOpen: !s.cardOpen })}
          data-testid="lesson-toggle"
        >
          <span className="micro">Guided exercises</span>
          <span className="mono text-[11px] text-ink-1">
            {doneCount} / 3 {s.cardOpen ? "–" : "▸"}
          </span>
        </button>
        {s.cardOpen && (
          <ol className="mt-2 space-y-1">
            {EXERCISES.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => startExercise(e.id)}
                  data-testid={`start-${e.id}`}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/[0.06]"
                >
                  <span className={`mono grid h-5 w-5 place-items-center rounded-full text-[10px] ${s.completed[e.id] ? "bg-subject text-[#0b0e14]" : "bg-white/10 text-ink-1"}`}>
                    {s.completed[e.id] ? "✓" : e.number}
                  </span>
                  <span className="text-[12.5px] text-ink-0">{e.title}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }
  const ex = exerciseById(s.active);
  const complete = !!s.completed[ex.id];
  const next = EXERCISES.find((e) => e.number === ex.number + 1);
  return (
    <div className="glass mt-3 max-w-[380px] px-3.5 py-3" data-testid="lesson-card" data-exercise={`${ex.id}${complete ? ":complete" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="micro">Exercise {ex.number} of 3</span>
        <button type="button" onClick={exitExercise} className="mono text-[11px] text-ink-2 hover:text-ink-0" aria-label="Exit exercise">
          Exit ×
        </button>
      </div>
      <h3 className="mt-1 text-[14.5px] font-semibold">{ex.title}</h3>
      <p className="mt-0.5 text-[12px] leading-snug text-ink-1">{ex.objective}</p>
      {ex.id !== "ex3" ? (
        <ul className="mt-2 space-y-1">
          {ex.steps.map((st, k) => {
            const done = st.done(s);
            return (
              <li key={k} className="flex items-start gap-2 text-[12px]">
                <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] ${done ? "bg-subject text-[#0b0e14]" : "border border-white/25"}`}>{done ? "✓" : ""}</span>
                <span className={done ? "text-ink-2" : "text-ink-0"}>
                  {st.text}
                  {st.hint && !done && <span className="mono ml-1.5 text-[10px] text-ink-3">{st.hint}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-2 space-y-1.5">
          {(Object.keys(OBJECTIVES) as ObjectiveId[]).map((o) => {
            const obj = OBJECTIVES[o];
            const savedId = s.progress.ex3.saved[o];
            const saved = s.shots.find((x) => x.id === savedId);
            const activeObj = s.objective === o;
            return (
              <div key={o} className={`rounded-lg border px-2.5 py-2 ${activeObj ? "border-[var(--color-distance)] bg-[rgb(255_181_71/0.06)]" : "border-white/10"}`} onClick={() => setObjective(o)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold">{obj.title}</span>
                  {saved && <span className="text-[10px] text-subject">✓ saved</span>}
                </div>
                <p className="mono mt-0.5 text-[10.5px] text-ink-2" title={obj.why}>
                  {saved ? saved.summary : obj.suggestion}
                </p>
                <button
                  type="button"
                  data-testid={`save-${o}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setObjective(o);
                    saveShot(o);
                  }}
                  className="mt-1.5 rounded-md bg-white/[0.08] px-2 py-0.5 text-[11px] text-ink-0 hover:bg-white/15"
                >
                  {saved ? "Replace with current shot" : "Save current shot"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {complete && (
        <div className="mt-2.5 rounded-lg bg-[rgb(142_240_195/0.1)] px-2.5 py-2 text-[12px] text-subject" data-testid="lesson-complete">
          Done. {ex.completion}
          <div className="mt-1.5 flex gap-2">
            {next ? (
              <button type="button" onClick={() => startExercise(next.id)} className="rounded-md bg-subject px-2 py-0.5 text-[11px] font-semibold text-[#0b0e14]">
                Next exercise ›
              </button>
            ) : null}
            <button type="button" onClick={exitExercise} className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-ink-0">
              Keep exploring
            </button>
          </div>
        </div>
      )}
      {s.shots.length > 0 && ex.id === "ex3" && (
        <div className="mt-2 flex flex-wrap gap-1">
          {s.shots.slice(-4).map((x) => (
            <button key={x.id} type="button" onClick={() => restoreShot(x.id)} className="mono rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-ink-1 hover:bg-white/15" title={x.phrase}>
              {x.summary.split(" · ").slice(0, 2).join(" · ")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
