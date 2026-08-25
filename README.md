# AI Security Benchmark Browser

A source-faithful analysis product for AI cybersecurity benchmark results. It keeps models, agent harnesses, evaluation harnesses, defenses, task context, and original metrics visible beneath a versioned Cybersecurity Index.

Live site: <https://hellerchr.github.io/ai-security-benchmark-web/>

## Current snapshot

- 40 cataloged public result sources
- 6 automated adapters: Cisco LLM Security Leaderboard, CyberGym-E2E, Wiz Cyber Model Arena, SEC-bench, AgentDojo, and Agent Security League
- Static, validated JSON committed in `public/data`; Git history is the snapshot history
- Daily refresh with failure retention and source-level coverage reporting
- Sortable and filterable model, harness, benchmark, and source leaderboards
- Model and harness index charts, score-versus-coverage analysis, detail breakdowns, and two-model comparison
- Cybersecurity Index v1.0: equal-weighted offensive capability, secure engineering, and AI resilience domains

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

## Cybersecurity Index

The model index uses six 0–100 source headline outcomes: Wiz Overall, SEC-bench Success, CyberGym-E2E S3, Agent Security League Secure, Cisco Combined Score, and AgentDojo safe utility. Scores are averaged within three equally weighted domains. A model ranks only with evidence in all three domains; incomplete scores are marked provisional and missing data is never counted as zero. See the in-product methodology for formulas, harness interpretation, and limitations.
