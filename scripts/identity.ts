import type { Harness, Result } from "../src/schema.js";

export const slug = (value: string): string => value
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const providerPrefixes = ["Anthropic", "OpenAI", "Google", "XAI", "Meta", "Amazon", "Mistral", "Moonshot", "MiniMax"];
const harnessAliases = new Map([
  ["claudecode", "Claude Code"],
  ["claude-code", "Claude Code"],
  ["sweagent", "SWE-Agent"],
  ["swe-agent", "SWE-Agent"],
  ["gemini-cli", "Gemini CLI"],
  ["open-hands", "OpenHands"],
  ["openhands", "OpenHands"],
]);

export const normalizeModel = (label: string, suppliedProvider: string | null): { id: string; name: string; provider: string | null; resolved: boolean } => {
  const prefix = providerPrefixes.find((candidate) => label.toLowerCase().startsWith(`${candidate.toLowerCase()} `));
  const name = prefix ? label.slice(prefix.length).trim() : label.trim();
  const provider = suppliedProvider || prefix || null;
  return { id: slug(name), name, provider, resolved: provider !== null };
};

export const normalizeHarness = (label: string, kind: Harness["kind"]): Harness => {
  const key = slug(label);
  const name = harnessAliases.get(key) ?? label.trim();
  return { id: `${kind}-${slug(name)}`, name, kind, aliases: name === label.trim() ? [] : [label.trim()] };
};

export const fieldCompleteness = (rows: Result[]): number => {
  if (!rows.length) return 0;
  const fields = rows.flatMap((row) => [row.modelLabel, row.harnessIds.length ? "yes" : null, row.metrics.length ? "yes" : null, row.taskSet, row.budget, row.backend, row.defense, row.attack, row.publishedAt]);
  return fields.filter((value) => value !== null && value !== "").length / fields.length;
};
