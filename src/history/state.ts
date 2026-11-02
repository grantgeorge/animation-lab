import { CHAPTER_IDS, type ChapterId, type HistoryState } from "./types";

export const DEFAULT_STATE: HistoryState = { chapterId: "drawings", view: "watch", compareChapterId: null, directorNote: "none" };

const isChapter = (v: string | null): v is ChapterId => !!v && (CHAPTER_IDS as readonly string[]).includes(v);

/** Parse durable view state from a query string. Unknown values fall back to defaults. */
export function parseState(search: string | URLSearchParams): HistoryState {
  const p = typeof search === "string" ? new URLSearchParams(search) : search;
  const chapter = p.get("chapter");
  const compare = p.get("compare");
  const chapterId = isChapter(chapter) ? chapter : DEFAULT_STATE.chapterId;
  return {
    chapterId,
    view: p.get("view") === "process" ? "process" : "watch",
    compareChapterId: isChapter(compare) ? compare : null,
    directorNote: p.get("note") === "blue-scarf" ? "blue-scarf" : "none",
  };
}

/** Serialize to a minimal query string (defaults omitted). */
export function serializeState(s: HistoryState): string {
  const p = new URLSearchParams();
  if (s.chapterId !== DEFAULT_STATE.chapterId) p.set("chapter", s.chapterId);
  if (s.view !== "watch") p.set("view", s.view);
  if (s.compareChapterId) p.set("compare", s.compareChapterId);
  if (s.directorNote !== "none") p.set("note", s.directorNote);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export function neighbor(id: ChapterId, dir: 1 | -1): ChapterId {
  const i = CHAPTER_IDS.indexOf(id);
  return CHAPTER_IDS[(i + dir + CHAPTER_IDS.length) % CHAPTER_IDS.length];
}
