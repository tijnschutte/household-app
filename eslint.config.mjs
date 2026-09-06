import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  // core-web-vitals is the React/Next correctness layer; typescript adds the
  // @typescript-eslint rules that catch what `tsc --noEmit` accepts but nobody
  // meant to write.
  ...nextVitals,
  ...nextTs,
  prettierConfig, // Disables ESLint rules that conflict with Prettier
  globalIgnores([
    ".next/",
    "node_modules/",
    "src/generated/",
    ".claude/",
    "next-env.d.ts",
    // One-off maintenance scripts, plain JS and not part of the build.
    "*.mjs",
    // Generated PWA output, regenerated on every build. Same reasoning as
    // .prettierignore: linting it reports on code we did not write.
    "public/sw.js",
    "public/workbox-*.js",
    "public/swe-worker-*.js",
    // The compiled form of worker/index.ts, which is linted at its source.
    "public/worker-*.js",
  ]),
]);

export default eslintConfig;
