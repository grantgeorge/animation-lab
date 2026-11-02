import { Suspense } from "react";
import "./history.css";
import { HistoryExperience } from "./HistoryExperience";
import { HistoryView } from "./HistoryView";
import { DEFAULT_STATE } from "./state";

/** Prerendered with the default chapter; the URL-bound experience takes over on the client. */
export function HistoryPage() {
  return (
    <Suspense fallback={<HistoryView state={DEFAULT_STATE} fallback />}>
      <HistoryExperience />
    </Suspense>
  );
}
