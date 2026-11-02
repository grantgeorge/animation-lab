import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const ui = Instrument_Sans({ variable: "--font-ui", subsets: ["latin"], axes: ["wdth"] });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Animation Lab",
  description: "An interactive school for animated filmmaking: lens and framing, camera movement, lighting, and timing and spacing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${mono.variable} dark h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
