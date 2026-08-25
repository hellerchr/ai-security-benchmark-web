import { describe, expect, it } from "vitest";
import { headlineScore, INDEX_VERSION, modelIndex } from "./indexScore";
import type { DataBundle, Result } from "./schema";

const result = (sourceId: string, metrics: Result["metrics"]): Result => ({ id: "r", sourceId, benchmarkId: sourceId, modelId: "m", modelLabel: "M", harnessIds: [], metrics, sourceUrl: "https://example.com", taskSet: null, budget: null, backend: null, defense: null, attack: null, publishedAt: null });
const metric = (name: string, value: number): Result["metrics"][number] => ({ name, value, displayValue: String(value), unit: "percent", direction: "higher" });

describe("Cybersecurity Index", () => {
  it("uses the versioned source headline metric", () => {
    expect(INDEX_VERSION).toBe("1.0");
    expect(headlineScore(result("cybergym-e2e", [metric("S3", 65.9), metric("S4", 22.2)]))).toBe(65.9);
  });

  it("combines AgentDojo safe utility and attack resistance", () => {
    expect(headlineScore(result("agentdojo", [metric("Utility under attack", 80), metric("Targeted ASR", 10)]))).toBe(85);
  });

  it("weights domains equally and ranks only complete domain coverage", () => {
    const bundle: DataBundle = {
      catalog: { generatedAt: "2026-01-01T00:00:00.000Z", sources: [], benchmarks: [], models: [{ id: "m", name: "M", provider: null, aliases: [] }], harnesses: [] },
      results: { generatedAt: "2026-01-01T00:00:00.000Z", results: [result("wiz-cyber-model-arena", [metric("Overall", 60)]), result("cybergym-e2e", [metric("S3", 30)]), result("cisco-llm-security", [metric("Combined score", 90)])] },
      coverage: { generatedAt: "2026-01-01T00:00:00.000Z", summary: { catalogSources: 0, automatedSources: 0, healthySources: 0, resultRows: 3, modelOverlap: 0, harnessOverlap: 0 }, sources: [] },
    };
    const score = modelIndex(bundle)[0];
    expect(score?.score).toBe(60);
    expect(score?.eligible).toBe(true);
  });
});
