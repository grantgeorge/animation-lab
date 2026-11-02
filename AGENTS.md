<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Animation Lab project rules

- `pnpm verify` green is necessary, never sufficient: review screenshots (`docs/screenshots/`, `scripts/shots.mjs`) before calling a change done.
- No commits or deploys unless the user asks.
- `src/engine` is pure math (three math classes only); keep it renderer-free and covered by Vitest.
- Numbers for the set, characters and camera live in `src/labs/lens-and-framing/config.ts`; dossier values enter code only through `docs/design/decisions.md`.
- One canvas: everything renders through `src/renderer/runtime/FrameOrchestrator.tsx`. Never add another positive-priority `useFrame`.
