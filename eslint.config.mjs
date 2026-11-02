import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The simulation engine is pure math: no React, renderer, framework or store imports.
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "react/*"], message: "engine must stay renderer-free" },
            { group: ["@react-three/*"], message: "engine must stay renderer-free" },
            { group: ["next", "next/*"], message: "engine must stay framework-free" },
            { group: ["zustand", "zustand/*"], message: "engine must not import stores" },
            { group: ["three/addons/*", "three/examples/*"], message: "engine uses three math classes only" },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
