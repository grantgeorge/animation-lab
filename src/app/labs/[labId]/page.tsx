import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { availableLabs, getLab } from "@/labs/registry";
import { LabShell } from "./LabShell";

export const dynamicParams = false;

export function generateStaticParams() {
  return availableLabs().map((l) => ({ labId: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/labs/[labId]">): Promise<Metadata> {
  const { labId } = await params;
  const lab = getLab(labId);
  return { title: lab ? `${lab.title} · Animation Lab` : "Animation Lab" };
}

export default async function LabPage({ params }: PageProps<"/labs/[labId]">) {
  const { labId } = await params;
  const lab = getLab(labId);
  if (!lab || lab.status !== "available" || !lab.entry) notFound();
  return <LabShell entry={lab.entry} />;
}
