---
name: implement
description: The implementation loop for household-app — build one bounded unit against a stated contract, prove the tests are armed, and report. Use when handed a unit of work to build or refactor, especially as a subagent. The counterpart to the read-only `improve` skill.
---

# Implementing one unit

`improve` surveys and plans but never writes. This is the other half: you have
been handed one bounded unit and you build it. Read `CLAUDE.md` for the design
rules — this skill is the loop, not a restatement of them.

**One unit is roughly one component, one module, or one contract.** If what you
were handed is larger than that, say so and propose the split before writing
code. A diff nobody can review in one sitting is not a finished unit.

## The loop

1. **Name the contract before implementing either side.** Data shapes and
   signatures first, then the boundary and the core independently against it.
   In this repo a contract is usually a `type` exported from the consumer — see
   `ItemSectionActions` or `HomeActions`. The consumer owns it; the provider
   satisfies it.
2. **Go RED first for a bug fix.** A failing test that exposes the bug, then the
   fix. For new behaviour the test may come after the code, but before you claim
   the unit is done.
3. **Write the code.** The PostToolUse hook runs prettier, eslint and tsc on
   every edit, so expect it to reject work mid-refactor — that is the loop
   working, not an obstacle. Finish the step and it clears.
4. **Run the gates**: `bun run verify`. All six must be green.
5. **Prove the tests are armed.** Follow the mutation probe in the `verify`
   skill. Mutate every behaviour your new tests claim to guard, one at a time,
   and confirm each produces a failure. Restore and confirm green.
6. **Report** in the shape below.

Steps 4 and 5 are not optional and not someone else's job. A reviewer at the end
can read your tests but cannot tell whether they would still pass with the code
deleted.

## Stop and ask instead of bolting it on

The test on every change: *knowing what we know now, is this how we would have
designed the system?* If the answer is no — if the only way to satisfy the brief
is to bolt onto a shape that no longer fits — **stop and report the trade-off
rather than implementing around it.**

This matters most when the brief is short. A terse instruction like "convert
this component to receive its actions as props" is satisfied by threading nine
props into a 600-line component, and that is the wrong answer: the logic worth
testing was buried inside it and wanted extracting first. Nobody will tell you
that in the prompt. Noticing it is the job.

Concretely, raise it when:

- The change would push a file past what fits on a screen, or mix two levels of
  abstraction in one function.
- You are about to write the same transform inline for the third time.
- The brief asks you to test something that is only untestable because of a
  design choice you could remove instead.
- Two call sites would have to stay manually in sync afterwards.

Report the trade-off in a sentence or two, say what you would do instead and
roughly how large it is, then continue with everything that does not depend on
the answer. Do not silently do the bigger refactor, and do not silently do the
worse thing.

## Where the standards actually live

Read in this order. The executable ones win, because prose goes stale and rules
do not:

| Source                    | What it settles                                          |
| ------------------------- | -------------------------------------------------------- |
| `.dependency-cruiser.cjs` | which module may import which — each rule has its rationale in a comment |
| `package.json` scripts    | what "green" means                                        |
| `verify` skill            | how to run the gates, the mutation probe, and the gotchas |
| `CLAUDE.md`               | the design rules and the testing philosophy               |
| `docs/engineering-principles.md` | the longer argument behind them                    |

If prose and a gate disagree, the gate is right and the prose needs fixing —
fix it in the same unit.

## Testing, in one paragraph

Tests are guardrails for refactoring, so assert on what the system achieved and
never on call sequences. Prefer fakes over mocks: a hand-rolled fake that
records what it was asked to do keeps you free to change the implementation, a
mock freezes it. Domain logic gets no doubles; the core gets fakes at the
boundary; anything that cannot be reached from the test loop stays untested and
you say so, rather than mocking the library and testing your own mock.

In this repo that means a client component takes its server actions as props and
a test passes a fake — never `vi.mock` for our own code. `tests/setup.ts` stands
in only for framework boundaries a component cannot control (the App Router,
`next-auth/react`).

## Reporting back

Your caller cannot see your context. Give them:

- **What changed**, by file, and the contract you introduced or satisfied.
- **What the tests cover**, and the mutation results as evidence — the mutation
  you applied and how many tests it broke.
- **Gate status**: the actual output of `bun run verify`, not a claim about it.
- **What you did not do**, and why — anything you left out, any trade-off you
  raised, any assumption you made to keep going.
- **Anything you learned that is not written down yet** — a server-action
  default, a library quirk, a rule that fired for a surprising reason. Propose
  adding it to the `verify` gotchas rather than leaving it in your context,
  which is about to be discarded.

Report failures faithfully. If a gate is red, show the output and say so; a unit
reported as done and verified must actually be both.
