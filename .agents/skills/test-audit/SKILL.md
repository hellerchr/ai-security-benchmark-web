---
name: test-audit
description: Audit the test suite of the AI Security Benchmark Browser against the product's data-integrity invariants (source adapters, exact identity resolution, failure retention, Cybersecurity Index math, snapshot validation). Use when asked to audit, review, or assess test coverage or test quality, before adding an adapter or changing index methodology, or when a data refresh produced surprising numbers.
---

# Test audit

This product's promise is that it is **source-faithful**: every number shown traces back to a published metric, identities are never fuzzy-merged, missing data is never counted as zero, and a failing source keeps its previous rows. A test audit answers one question: *which of those promises could silently break today without `pnpm check` going red?*

The audit is read-only by default. Report findings; only write or change tests when the user asks for fixes.

## 1. Establish the baseline

```sh
pnpm install --frozen-lockfile
pnpm test            # vitest: scripts/**/*.test.ts, src/**/*.test.ts
pnpm check           # test + validate:data + typecheck + build (what CI runs)
```

Record the pass/fail counts. A red baseline is itself the first finding. Do not run `pnpm crawl` during an audit: it hits live sites and rewrites `public/data`.

List what is tested vs. what exists:

```sh
ls scripts src
grep -n "describe\|it(" scripts/*.test.ts src/*.test.ts
grep -n "^export" scripts/*.ts src/*.ts
```

Every exported function with branching logic and no test is a candidate gap.

## 2. Audit against the invariants

Work through each area. For each check, find the test that would fail if the behaviour regressed. If no such test exists, that's a finding.

### A. Source adapters: `scripts/adapters.ts`

For **each** `parse*` function (Wiz, SEC-bench, AgentDojo, Agent Security League, Cisco, CyberGym-E2E):

- **Every metric** the adapter emits has its `name`, `value`, `unit` and `direction` asserted, not just one of them. A wrong unit or direction corrupts sorting and comparison without breaking anything else.
- **Model label vs. harness label splitting** is asserted (e.g. Wiz strips the harness `<span>` suffix from the model cell).
- **Optional context fields** (`provider`, `backend`, `defense`, `attack`, `taskSet`, `budget`, `publishedAt`) are asserted where the adapter sets them.
- **Drop rules**: a row with no model label or no parseable metric is dropped, not emitted with empty metrics.
- **Branches**: AgentDojo `defense === "None"` yields no defense harness; Cisco `Pass` is scaled ×100; CyberGym numeric `task_set` becomes a string.
- **Schema failures** for JSON adapters throw (`parseCisco`, `parseCyberGym`).
- **Fixtures resemble the real markup.** Compare the fixture HTML against a real row in `public/data/results.json` (look at `displayValue`). If `displayValue` holds text the fixture never had (extra units, concatenated cells), the fixture is idealised and the parser's real-world behaviour is untested.
- One `it` per adapter is preferred, so a failure names the broken source.

### B. Identity and crawl: `scripts/crawl.ts`

- `slug`, `normalizeModel` and `normalizeHarness` are covered: provider-prefix stripping, exact alias table hits, and **non-matches stay distinct** (no fuzzy merge, e.g. `Claude Opus 4.6` ≠ `Claude Opus 4.5`).
- **Failure retention**: when a source throws, the previous rows are kept with `crawlStatus: "retained"`, `retainedPrevious: true`, the error is recorded, and `lastSuccessAt` is carried over; with no previous rows the status is `"failed"`.
- An empty result set is treated as a failure.
- `fieldCompleteness` and the coverage summary counts (`healthySources`, `modelOverlap`, `harnessOverlap`).
- **Testability**: `crawl.ts` calls `await main()` at module top level, so importing it from a test would run a live crawl and write files. If that's still true, report it as the blocker for everything in this section, and suggest splitting the pure helpers into a module with no side effects.

### C. Cybersecurity Index: `src/indexScore.ts`

- `headlineScore` for each of the six `INDEX_SOURCES`, including AgentDojo safe utility `(UUA + 100 − ASR) / 2` and `null` when either input is missing.
- Non-index sources return `null`.
- **Missing data is never zero**: a model with only one or two domains is `eligible: false`, and its score is the mean of the domains it *has*.
- Domains are equally weighted regardless of how many sources each domain has (e.g. 2 offensive sources + 1 secure-coding source ≠ mean of 3).
- A model with multiple rows per source takes the **max** headline score.
- Rounding to one decimal.
- `harnessIndex`: only `agent` harnesses, eligibility (≥2 components and ≥3 models), `controlledLift` only from same source+model groups with ≥2 harnesses.
- `INDEX_VERSION` is pinned by a test, so a methodology change forces a deliberate version bump.

### D. Snapshot and schema: `src/schema.ts`, `scripts/validate-data.ts`

- `validate:data` runs in `pnpm build`, so the committed snapshot is referentially checked. Its error branches (unknown source, benchmark, model, harness, coverage source) are not unit tested. Note this, but it's low severity unless the checks change.
- Schema enums (`unit`, `direction`, `crawlStatus`, harness `kind`) match what the adapters and crawler emit.
- Spot-check `public/data` for **plausibility** that no schema catches: units consistent with `displayValue`, percentages within 0–100, `direction` sensible for the metric name.

### E. UI: `src/App.tsx`

There's no component testing setup. Only report UI gaps if the UI does its own computation (sorting, filtering, formatting) that could misrepresent a number. Pure rendering is low priority.

### F. CI wiring: `.github/workflows/`

- `pages.yml` runs `pnpm check` on PRs and on pushes to `main`.
- `refresh-data.yml` runs `pnpm check` **after** `pnpm crawl` and before committing, so a bad crawl can't be committed.
- Tests don't depend on network or the current date.

## 3. Judge test quality, not just presence

Flag tests that pass but prove little:

- Assertions on one field when the function produces many.
- Several unrelated behaviours packed into one `it`.
- Fixtures that can't exercise the failure mode (e.g. an eligibility test where every model is eligible).
- `?.` chains in expectations are fine with `toBe(value)`, but not with `toBeUndefined()`/`toBeFalsy()`.
- Snapshot-style assertions on whole objects that would hide which field regressed.

## 4. Report

Output a single report:

1. **Baseline**: command results and counts.
2. **Findings table**, ranked by severity:

   | # | Severity | Area | Finding | Evidence (`file:line`) | Suggested test |
   |---|----------|------|---------|------------------------|----------------|

   Severity:
   - **Critical**: a published number or ranking can be wrong today (a real bug found while auditing).
   - **High**: a core invariant (A–C) has no test that would catch a regression.
   - **Medium**: partial coverage or a weak assertion on a core path.
   - **Low**: hygiene, UI, or error-message branches.

3. **Top 3 next tests to write**, each with a concrete input and the expected output.

If the audit uncovers a real bug (not just a missing test), lead with it and say where it shows up in `public/data`. Don't fix production code as part of the audit unless asked.
