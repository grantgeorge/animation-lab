// Fails if the home page ships three.js. The lab is a separate client chunk loaded only on /labs/*.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = ".next";
const manifestPath = join(root, "server", "app", "page_client-reference-manifest.js");
if (!existsSync(manifestPath)) {
  console.error(`check-home-bundle: ${manifestPath} not found — run pnpm build first`);
  process.exit(1);
}
const manifest = readFileSync(manifestPath, "utf8");
const chunks = [...new Set([...manifest.matchAll(/static\/chunks\/[^"\\]+\.js/g)].map((m) => m[0]))];
const offenders = chunks.filter((c) => {
  const p = join(root, c);
  if (!existsSync(p)) return false;
  const src = readFileSync(p, "utf8");
  return src.includes("WebGLRenderer") || src.includes("THREE.WebGLRenderer");
});
if (offenders.length) {
  console.error("check-home-bundle: the home page loads three.js via", offenders);
  process.exit(1);
}
console.log(`check-home-bundle: ok (${chunks.length} home chunks, none contain three.js)`);
void readdirSync;
