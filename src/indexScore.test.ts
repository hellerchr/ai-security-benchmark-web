import { describe, expect, it } from "vitest";
import { harnessIndex, headlineScore, INDEX_SOURCES, INDEX_VERSION, modelIndex } from "./indexScore";
import type { DataBundle, Harness, Result } from "./schema";

const generatedAt = "2026-01-01T00:00:00.000Z";
const result = (sourceId: string, metrics: Record<string, number>, modelId = "m", harnessIds: string[] = []): Result => ({
  id: `${sourceId}-${modelId}`, sourceId, benchmarkId: sourceId, modelId, modelLabel: modelId, harnessIds, sourceUrl: "https://example.com",
  metrics: Object.entries(metrics).map(([name, value]) => ({ name, value, displayValue: String(value), unit: "percent", direction: "higher" })),
  taskSet: null, budget: null, backend: null, defense: null, attack: null, publishedAt: null,
});
const harness = (id: string, kind: Harness["kind"] = "agent"): Harness => ({ id, name: id, kind, aliases: [] });
const bundle = (results: Result[], harnesses: Harness[] = []): DataBundle => ({
  catalog: { generatedAt, sources: [], benchmarks: [], models: [...new Set(results.map(({ modelId }) => modelId))].map((id) => ({ id, name: id, provider: null, aliases: [] })), harnesses },
  results: { generatedAt, results },
  coverage: { generatedAt, summary: { catalogSources: 0, automatedSources: 0, healthySources: 0, resultRows: results.length, modelOverlap: 0, harnessOverlap: 0 }, sources: [] },
});

describe("headlineScore", () => {
  it("is pinned to index version 1.0", () => {
    expect(INDEX_VERSION).toBe("1.0");
  });

  it.each(INDEX_SOURCES.filter(({ sourceId }) => sourceId !== "agentdojo"))("reads $metric for $sourceId", ({ sourceId, metric }) => {
    expect(headlineScore(result(sourceId, { Other: 1, [metric]: 42 }))).toBe(42);
  });

  it("scores AgentDojo as safe utility and needs both inputs", () => {
    expect(headlineScore(result("agentdojo", { "Utility under attack": 80, "Targeted ASR": 10 }))).toBe(85);
    expect(headlineScore(result("agentdojo", { "Utility under attack": 80 }))).toBeNull();
  });

  it("ignores sources outside the index", () => {
    expect(headlineScore(result("cybench", { Overall: 90 }))).toBeNull();
  });
});

describe("modelIndex", () => {
  it("weights the three domains equally, not the sources", () => {
    const [score] = modelIndex(bundle([
      result("wiz-cyber-model-arena", { Overall: 80 }), result("sec-bench", { Success: 60 }),
      result("cybergym-e2e", { S3: 40 }), result("cisco-llm-security", { "Combined score": 100 }),
    ]));
    expect(score).toMatchObject({ score: 70, eligible: true, coverage: 4, categoryScores: { offensive: 70, "secure-coding": 40, "ai-system-security": 100 } });
  });

  it("marks partial coverage provisional instead of counting missing domains as zero", () => {
    const [score] = modelIndex(bundle([result("wiz-cyber-model-arena", { Overall: 60 }), result("cisco-llm-security", { "Combined score": 90 })]));
    expect(score).toMatchObject({ score: 75, eligible: false, categories: 2 });
  });

  it("uses a model's best row per source and skips models with no index data", () => {
    const scores = modelIndex(bundle([result("wiz-cyber-model-arena", { Overall: 50 }), result("wiz-cyber-model-arena", { Overall: 70 }), result("cybench", { Overall: 99 }, "other")]));
    expect(scores.map(({ id, score }) => [id, score])).toEqual([["m", 70]]);
  });
});

describe("harnessIndex", () => {
  const scores = harnessIndex(bundle([
    result("wiz-cyber-model-arena", { Overall: 60 }, "m1", ["a", "eval"]),
    result("wiz-cyber-model-arena", { Overall: 40 }, "m1", ["b", "eval"]),
    result("wiz-cyber-model-arena", { Overall: 50 }, "m2", ["a"]),
    result("cybergym-e2e", { S3: 30 }, "m3", ["a"]),
  ], [harness("a"), harness("b"), harness("eval", "evaluation")]));
  const byId = Object.fromEntries(scores.map((score) => [score.id, score]));

  it("scores only agent harnesses", () => {
    expect(Object.keys(byId).sort()).toEqual(["a", "b"]);
  });

  it("requires two index sources and three models to rank", () => {
    expect(byId.a).toMatchObject({ eligible: true, models: 3, coverage: 2 });
    expect(byId.b).toMatchObject({ eligible: false, models: 1 });
  });

  it("measures lift only against other harnesses on the same source and model", () => {
    expect(byId.a).toMatchObject({ controlledLift: 10, controlledComparisons: 1 });
    expect(byId.b).toMatchObject({ controlledLift: -10, controlledComparisons: 1 });
  });
});
