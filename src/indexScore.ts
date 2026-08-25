import type { Category, DataBundle, Result } from "./schema";

export const INDEX_VERSION = "1.0";
export const INDEX_SOURCES = [
  { sourceId: "wiz-cyber-model-arena", category: "offensive", metric: "Overall", label: "Wiz Cyber Model Arena" },
  { sourceId: "sec-bench", category: "offensive", metric: "Success", label: "SEC-bench Pro" },
  { sourceId: "cybergym-e2e", category: "secure-coding", metric: "S3", label: "CyberGym-E2E" },
  { sourceId: "agent-security-league", category: "secure-coding", metric: "Secure", label: "Agent Security League" },
  { sourceId: "cisco-llm-security", category: "ai-system-security", metric: "Combined score", label: "Cisco LLM Security" },
  { sourceId: "agentdojo", category: "ai-system-security", metric: "Safe utility", label: "AgentDojo" },
] satisfies { sourceId: string; category: Category; metric: string; label: string }[];

export type IndexComponent = { sourceId: string; label: string; category: Category; score: number };
export type IndexScore = {
  id: string;
  score: number;
  eligible: boolean;
  coverage: number;
  categories: number;
  components: IndexComponent[];
  categoryScores: Partial<Record<Category, number>>;
};

const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value: number): number => Math.round(value * 10) / 10;
const namedMetric = (result: Result, name: string): number | null => result.metrics.find((metric) => metric.name === name)?.value ?? null;

export function headlineScore(result: Result): number | null {
  const rule = INDEX_SOURCES.find(({ sourceId }) => sourceId === result.sourceId);
  if (!rule) return null;
  if (result.sourceId === "agentdojo") {
    const utility = namedMetric(result, "Utility under attack");
    const attackSuccess = namedMetric(result, "Targeted ASR");
    return utility === null || attackSuccess === null ? null : (utility + 100 - attackSuccess) / 2;
  }
  return namedMetric(result, rule.metric);
}

function finishScore(id: string, components: IndexComponent[], eligible: boolean): IndexScore {
  const categoryScores: Partial<Record<Category, number>> = {};
  for (const category of ["offensive", "secure-coding", "ai-system-security"] as const) {
    const scores = components.filter((component) => component.category === category).map(({ score }) => score);
    if (scores.length) categoryScores[category] = round(mean(scores));
  }
  const categoryValues = Object.values(categoryScores);
  return { id, score: round(mean(categoryValues)), eligible, coverage: components.length, categories: categoryValues.length, components, categoryScores };
}

export function modelIndex(bundle: DataBundle): IndexScore[] {
  return bundle.catalog.models.map((model) => {
    const components = INDEX_SOURCES.flatMap((rule) => {
      const values = bundle.results.results.filter((result) => result.modelId === model.id && result.sourceId === rule.sourceId).map(headlineScore).filter((value): value is number => value !== null);
      return values.length ? [{ sourceId: rule.sourceId, label: rule.label, category: rule.category, score: round(Math.max(...values)) }] : [];
    });
    return finishScore(model.id, components, components.length >= 3 && new Set(components.map(({ category }) => category)).size === 3);
  }).filter(({ components }) => components.length > 0);
}

export type HarnessIndexScore = IndexScore & { models: number; controlledLift: number | null; controlledComparisons: number };

export function harnessIndex(bundle: DataBundle): HarnessIndexScore[] {
  const agents = bundle.catalog.harnesses.filter(({ kind }) => kind === "agent");
  const rowsWithScores = bundle.results.results.flatMap((result) => {
    const score = headlineScore(result);
    const harnessIds = result.harnessIds.filter((id) => agents.some((agent) => agent.id === id));
    return score === null ? [] : harnessIds.map((harnessId) => ({ result, harnessId, score }));
  });
  const controlled = new Map<string, number[]>();
  const groups = new Map<string, typeof rowsWithScores>();
  rowsWithScores.forEach((row) => {
    const key = `${row.result.sourceId}:${row.result.modelId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  for (const group of groups.values()) {
    const harnesses = new Set(group.map(({ harnessId }) => harnessId));
    if (harnesses.size < 2) continue;
    const baseline = mean(group.map(({ score }) => score));
    group.forEach(({ harnessId, score }) => controlled.set(harnessId, [...(controlled.get(harnessId) ?? []), score - baseline]));
  }
  return agents.map((harness) => {
    const harnessRows = rowsWithScores.filter(({ harnessId }) => harnessId === harness.id);
    const components = INDEX_SOURCES.flatMap((rule) => {
      const values = harnessRows.filter(({ result }) => result.sourceId === rule.sourceId).map(({ score }) => score);
      return values.length ? [{ sourceId: rule.sourceId, label: rule.label, category: rule.category, score: round(mean(values)) }] : [];
    });
    const modelCount = new Set(harnessRows.map(({ result }) => result.modelId)).size;
    const lifts = controlled.get(harness.id) ?? [];
    return { ...finishScore(harness.id, components, components.length >= 2 && modelCount >= 3), models: modelCount, controlledLift: lifts.length ? round(mean(lifts)) : null, controlledComparisons: lifts.length };
  }).filter(({ components }) => components.length > 0);
}
