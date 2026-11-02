import type { Metadata } from "next";
import { HistoryPage } from "@/history/HistoryPage";

export const metadata: Metadata = {
  title: "How Animation Evolved · Animation Lab",
  description: "Explore the same scene through a century of animation, then see what changes with generative AI.",
};

export default function Page() {
  return <HistoryPage />;
}
