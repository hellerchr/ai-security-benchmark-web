# AI Security Benchmark Browser

A source-faithful browser for AI cybersecurity benchmark results. It keeps models, agent harnesses, evaluation harnesses, defenses, task context, and original metrics separate instead of manufacturing a universal score.

## Current snapshot

- 40 cataloged public result sources
- 6 automated adapters: Cisco LLM Security Leaderboard, CyberGym-E2E, Wiz Cyber Model Arena, SEC-bench, AgentDojo, and Agent Security League
- Static, validated JSON committed in `public/data`; Git history is the snapshot history
- Daily refresh with failure retention and source-level coverage reporting

## Run locally

```sh
pnpm install
pnpm crawl
pnpm dev
```

`pnpm check` runs parser checks, validates data references, typechecks, and builds the site.

## Data files

- `catalog.json`: sources, benchmarks, models, harnesses, and exact aliases
- `results.json`: source rows with all published metrics and configuration context
- `coverage.json`: source health, automation status, row counts, field completeness, and identity gaps

The crawler never fuzzy-merges model or harness names. If a live source fails, the previous rows are retained and the source is marked `retained` with the crawl error. The browser should not be used as a safety certification.
