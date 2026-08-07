/**
 * Architecture contracts for household-app. Run: bun run arch
 *
 * These add no indirection. Every rule below records a boundary the code
 * already keeps, so that it keeps being kept. The three-tier shape
 * (app -> components -> lib) is acyclic today; these rules are what stop it
 * drifting once an agent is generating changes faster than they get read.
 *
 * Every rule was verified green against the whole tree before being enabled,
 * and then verified to fire against a deliberate violation — green alone does
 * not prove a rule is armed, only that nothing matched it.
 *
 * Each `comment` states the remediation, not just the prohibition — it is the
 * text an agent sees when the rule fires.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment:
        "This module is part of an import cycle. A cycle means neither module can be " +
        "read, tested or deleted on its own. Break it by moving the shared piece down " +
        "into src/lib/, or by passing the value in as an argument.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "lib-is-the-bottom-of-the-stack",
      comment:
        "src/lib/ must not import from src/app/. lib holds the Prisma client, the " +
        "server actions and the pure calculations — it is what the UI is built from, " +
        "so it cannot depend on a route. If lib needs a value the route has, take it " +
        "as an argument.",
      severity: "error",
      from: { path: "^src/lib/" },
      to: { path: "^src/app/" },
    },
    {
      name: "lib-must-not-import-components",
      comment:
        "src/lib/ must not import from src/components/. A module that needs JSX is a " +
        "component and belongs in src/components/; a module that only computes or " +
        "talks to the database belongs in src/lib/.",
      severity: "error",
      from: { path: "^src/lib/" },
      to: { path: "^src/components/" },
    },
    {
      name: "components-must-not-import-routes",
      comment:
        "src/components/ must not import from src/app/. A shared component cannot " +
        "depend on one route, or it stops being shared. Move what you need into " +
        "src/lib/ or pass it in as a prop.",
      severity: "error",
      from: { path: "^src/components/" },
      to: { path: "^src/app/" },
    },
    {
      name: "the-database-stays-behind-the-server-layer",
      comment:
        "Only src/lib/ may import src/lib/db/. Routes and components reach the " +
        "database through a server action or a data function that has already called " +
        "requireUser() and scoped the query to the caller's household — importing " +
        "prisma directly is how an ownership check gets skipped.",
      severity: "error",
      from: { path: "^src/(app|components)/" },
      to: { path: "^src/lib/db/" },
    },
    {
      name: "presentational-primitives-stay-presentational",
      comment:
        "src/components/ui/ must not import actions, data, auth or session. These are " +
        "the vendored shadcn primitives: they render what they are given. A primitive " +
        "that fetches or mutates belongs in a feature component one level up.",
      severity: "error",
      from: { path: "^src/components/ui/" },
      to: { path: "^src/lib/(actions|data|auth|session)" },
    },
    {
      name: "route-handlers-render-nothing",
      comment:
        "src/app/api/ is server-side: it must not import src/components/ or react. A " +
        "route handler returns data, never UI.",
      severity: "error",
      from: { path: "^src/app/api/" },
      to: { path: "^src/components/|node_modules/react(-dom)?/" },
    },
    {
      name: "the-validation-schema-is-a-shared-leaf",
      comment:
        "src/lib/schema.ts must not import prisma, next or react. It is the zod " +
        "contract that a client form and a server action both parse against; pulling " +
        "in a server-only dependency drags the Prisma client into the browser bundle.",
      severity: "error",
      from: { path: "^src/lib/schema\\.ts$" },
      to: { path: "^src/lib/db/|node_modules/(@prisma/|prisma/|next/|react(-dom)?/)" },
    },
    {
      name: "money-is-pure",
      comment:
        "src/lib/geld/money.ts must not import prisma, next or react. Its own header " +
        "promises it runs on both client and server — formatting in components, " +
        "parsing in forms, month arithmetic in the server page. Keep that true.",
      severity: "error",
      from: { path: "^src/lib/geld/money\\.ts$" },
      to: { path: "^src/lib/db/|node_modules/(@prisma/|prisma/|next/|react(-dom)?/)" },
    },
  ],
  options: {
    // node_modules must stay OUT of `exclude` and only in `doNotFollow`:
    // excluding it drops packages from the graph entirely, which silently
    // disarms every rule that names a node_modules target. doNotFollow keeps
    // them as leaves — matchable, but not walked into.
    doNotFollow: { path: "node_modules" },
    exclude: {
      path: [
        "^(\\.next|public)/",
        "^\\.claude/",
        "^src/lib/db/migrations/",
        // Tests sit beside their source and import it directly; the layering
        // rules describe the shipped graph, not the test graph.
        "\\.test\\.tsx?$",
      ],
    },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".js", ".jsx", ".ts", ".tsx"],
    },
  },
};
