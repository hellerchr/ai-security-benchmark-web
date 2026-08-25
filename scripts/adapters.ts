import { load } from "cheerio";
import { z } from "zod";
import type { Harness, Metric, Source } from "../src/schema.js";

export type RawResult = {
  modelLabel: string;
  provider: string | null;
  harnesses: { label: string; kind: Harness["kind"] }[];
  metrics: Metric[];
  taskSet?: string;
  budget?: string;
  backend?: string;
  defense?: string;
  attack?: string;
  publishedAt?: string;
};

const clean = (value: string): string => value.replace(/\s+/g, " ").trim();
const numberFrom = (value: string): number | null => {
  const match = value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};
const metric = (name: string, displayValue: string, unit: Metric["unit"], direction: Metric["direction"]): Metric | null => {
  const value = numberFrom(displayValue);
  return value === null ? null : { name, value, displayValue: clean(displayValue), unit, direction };
};
const present = <T>(value: T | null): value is T => value !== null;

export function parseWiz(html: string): RawResult[] {
  const $ = load(html);
  return $("table").first().find("tbody tr").toArray().flatMap((row) => {
    const cells = $(row).find("td");
    const configuration = cells.eq(1);
    const harness = clean(configuration.find("span").first().text());
    const combined = clean(configuration.text());
    const modelLabel = harness && combined.endsWith(harness) ? combined.slice(0, -harness.length).trim() : combined;
    const metrics = [
      metric("Code vulnerabilities", cells.eq(2).text(), "percent", "higher"),
      metric("API security", cells.eq(3).text(), "percent", "higher"),
      metric("Web security", cells.eq(4).text(), "percent", "higher"),
      metric("Cloud security", cells.eq(5).text(), "percent", "higher"),
      metric("Overall", cells.eq(6).text(), "percent", "higher"),
      metric("Average time", cells.eq(7).text(), "seconds", "lower"),
    ].filter(present);
    return modelLabel && metrics.length ? [{ modelLabel, provider: null, harnesses: harness ? [{ label: harness, kind: "agent" }] : [], metrics }] : [];
  });
}

export function parseSecBench(html: string): RawResult[] {
  const $ = load(html);
  return $("#overall-table tbody tr").toArray().flatMap((row) => {
    const cells = $(row).find("td");
    const modelLabel = clean(cells.eq(1).find(".model-name-text").text());
    const harness = clean(cells.eq(1).find(".model-meta").text());
    const provider = clean(cells.eq(4).text()) || null;
    const success = metric("Success", cells.eq(2).text(), "percent", "higher");
    const completed = metric("Completed", cells.eq(3).text(), "count", "higher");
    const metrics = [success, completed].filter(present);
    return modelLabel && metrics.length ? [{
      modelLabel,
      provider,
      harnesses: harness ? [{ label: harness, kind: "agent" }] : [],
      metrics,
      backend: clean(cells.eq(5).text()) || undefined,
    }] : [];
  });
}

export function parseAgentDojo(html: string): RawResult[] {
  const $ = load(html);
  return $("#results-table tbody tr").toArray().flatMap((row) => {
    const cells = $(row).find("td");
    const provider = clean(cells.eq(0).text());
    const modelLabel = clean(cells.eq(1).text());
    const defense = clean(cells.eq(2).text());
    const attack = clean(cells.eq(3).text());
    const metrics = [
      metric("Utility", cells.eq(4).text(), "percent", "higher"),
      metric("Utility under attack", cells.eq(5).text(), "percent", "higher"),
      metric("Targeted ASR", cells.eq(6).text(), "percent", "lower"),
    ].filter(present);
    return modelLabel && metrics.length ? [{
      modelLabel,
      provider: provider || null,
      harnesses: defense && defense !== "None" ? [{ label: defense, kind: "defense" }] : [],
      metrics,
      defense: defense || undefined,
      attack: attack || undefined,
      publishedAt: clean(cells.eq(7).text()) || undefined,
    }] : [];
  });
}

export function parseAgentSecurityLeague(html: string): RawResult[] {
  const $ = load(html);
  return $("[fs-list-element=item]").toArray().flatMap((row) => {
    const blocks = $(row).find(".security-tab-item_block");
    const harness = clean($(row).find('[fs-list-field="agent"]').text());
    const modelLabel = clean($(row).find('[fs-list-field="model"]').text());
    const metrics = [
      metric("Functional", blocks.eq(3).text(), "percent", "higher"),
      metric("Secure", blocks.eq(4).text(), "percent", "higher"),
    ].filter(present);
    return modelLabel && metrics.length ? [{
      modelLabel,
      provider: null,
      harnesses: harness ? [{ label: harness, kind: "agent" }] : [],
      metrics,
      publishedAt: clean(blocks.eq(5).text()) || undefined,
    }] : [];
  });
}

const ciscoSchema = z.object({
  data: z.array(z.object({
    model: z.string(),
    Pass: z.number().optional(),
    validation_score: z.number().optional(),
    multi_turn_resistance: z.number().optional(),
    multi_turn_success: z.number().optional(),
    multi_turn_attacks: z.number().optional(),
    combined_score: z.number().optional(),
  })),
});

export function parseCisco(value: unknown): RawResult[] {
  return ciscoSchema.parse(value).data.flatMap((row) => {
    const candidates: [string, number | undefined, Metric["unit"], Metric["direction"]][] = [
      ["Pass rate", row.Pass === undefined ? undefined : row.Pass * 100, "percent", "higher"],
      ["Validation score", row.validation_score, "score", "higher"],
      ["Multi-turn resistance", row.multi_turn_resistance, "percent", "higher"],
      ["Multi-turn attack success", row.multi_turn_success, "percent", "lower"],
      ["Multi-turn attacks", row.multi_turn_attacks, "count", "neutral"],
      ["Combined score", row.combined_score, "score", "higher"],
    ];
    const metrics = candidates.flatMap(([name, value, unit, direction]) => value === undefined ? [] : [{ name, value, displayValue: unit === "percent" ? `${value.toFixed(1)}%` : String(value), unit, direction }]);
    return metrics.length ? [{ modelLabel: row.model, provider: null, harnesses: [], metrics }] : [];
  });
}

const cyberGymSchema = z.object({
  results: z.array(z.object({
    model: z.string(),
    harness: z.string(),
    task_set: z.union([z.string(), z.number()]),
    budget: z.string(),
    patch_only: z.number().optional(),
    s1: z.number().optional(),
    s2: z.number().optional(),
    s3: z.number().optional(),
    s4: z.number().optional(),
  })),
});

export function parseCyberGym(value: unknown): RawResult[] {
  return cyberGymSchema.parse(value).results.flatMap((row) => {
    const metrics = [
      ["Patch only", row.patch_only], ["S1", row.s1], ["S2", row.s2], ["S3", row.s3], ["S4", row.s4],
    ].flatMap(([name, value]) => typeof value === "number" ? [{ name: String(name), value, displayValue: `${value}%`, unit: "percent" as const, direction: "higher" as const }] : []);
    return metrics.length ? [{
      modelLabel: row.model,
      provider: null,
      harnesses: [{ label: row.harness, kind: "agent" }],
      metrics,
      taskSet: String(row.task_set),
      budget: row.budget,
    }] : [];
  });
}

const fetchValue = async (url: string, format: "json" | "text"): Promise<unknown> => {
  const response = await fetch(url, { headers: { "user-agent": "ai-security-benchmark-browser/1.0" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return format === "json" ? response.json() : response.text();
};

export async function crawlSource(source: Source): Promise<RawResult[]> {
  switch (source.adapter) {
    case "cisco": return parseCisco(await fetchValue("https://leaderboard.aidefense.cisco.com/api/rankings", "json"));
    case "cybergym-e2e": return parseCyberGym(await fetchValue("https://www.cybergym.io/assets/data/cybergym-e2e.json", "json"));
    case "wiz": return parseWiz(String(await fetchValue(source.url, "text")));
    case "sec-bench": return parseSecBench(String(await fetchValue(source.url, "text")));
    case "agentdojo": return parseAgentDojo(String(await fetchValue(source.url, "text")));
    case "agent-security-league": return parseAgentSecurityLeague(String(await fetchValue(source.url, "text")));
    case null: return [];
  }
}
