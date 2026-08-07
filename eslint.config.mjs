import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import prettierConfig from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // core-web-vitals is the React/Next correctness layer; typescript adds the
  // @typescript-eslint rules that catch what `tsc --noEmit` accepts but nobody
  // meant to write.
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  prettierConfig, // Disables ESLint rules that conflict with Prettier
  {
    ignores: [
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
    ],
  },
];

export default eslintConfig;
