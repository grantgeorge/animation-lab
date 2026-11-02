import { existsSync } from "node:fs";

export default function globalSetup() {
  if (!process.env.BASE_URL && !existsSync(".next/BUILD_ID")) {
    throw new Error("No production build found: run `pnpm build` first (or set BASE_URL to a running server).");
  }
}
