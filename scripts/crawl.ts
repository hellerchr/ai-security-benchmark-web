import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { catalogSchema, coverageSchema, resultsDocumentSchema, type Catalog, type Coverage, type Harness, type Model, type Result, type ResultsDocument, type SourceCoverage } from "../src/schema.js";
import { crawlSource, type RawResult } from "./adapters.js";
import { sources } from "./registry.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = join(root, "public", "data");
const generatedAt = new Date().toISOString();

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

const normalizeModel = (label: string, suppliedProvider: string | null): { id: string; name: string; provider: string | null; resolved: boolean } => {
  const prefix = providerPrefixes.find((candidate) => label.toLowerCase().startsWith(`${candidate.toLowerCase()} `));
  const name = prefix ? label.slice(prefix.length).trim() : label.trim();
  const provider = suppliedProvider || prefix || null;
  return { id: slug(name), name, provider, resolved: provider !== null };
};

const normalizeHarness = (label: string, kind: Harness["kind"]): Harness => {
  const key = slug(label);
  const name = harnessAliases.get(key) ?? label.trim();
  return { id: `${kind}-${slug(name)}`, name, kind, aliases: name === label.trim() ? [] : [label.trim()] };
};

const readPrevious = async (): Promise<{ results: ResultsDocument | null; coverage: Coverage | null }> => {
  try {
    const [resultsText, coverageText] = await Promise.all([
      readFile(join(dataDirectory, "results.json"), "utf8"),
      readFile(join(dataDirectory, "coverage.json"), "utf8"),
    ]);
    return { results: resultsDocumentSchema.parse(JSON.parse(resultsText)), coverage: coverageSchema.parse(JSON.parse(coverageText)) };
  } catch {
    return { results: null, coverage: null };
  }
};

const fieldCompleteness = (rows: Result[]): number => {
  if (!rows.length) return 0;
  const fields = rows.flatMap((row) => [row.modelLabel, row.harnessIds.length ? "yes" : null, row.metrics.length ? "yes" : null, row.taskSet, row.budget, row.backend, row.defense, row.attack, row.publishedAt]);
  return fields.filter((value) => value !== null && value !== "").length / fields.length;
};

const convert = (sourceId: string, sourceUrl: string, rows: RawResult[], models: Map<string, Model>, harnesses: Map<string, Harness>): { results: Result[]; unresolvedModels: number } => {
  let unresolvedModels = 0;
  const evaluationHarness = normalizeHarness(sources.find((source) => source.id === sourceId)?.name ?? sourceId, "evaluation");
  harnesses.set(evaluationHarness.id, evaluationHarness);
  const results = rows.map((row, index) => {
    const normalizedModel = normalizeModel(row.modelLabel, row.provider);
    if (!normalizedModel.resolved) unresolvedModels += 1;
    const existingModel = models.get(normalizedModel.id);
    const aliases = existingModel ? [...new Set([...existingModel.aliases, row.modelLabel].filter((alias) => alias !== existingModel.name))] : row.modelLabel === normalizedModel.name ? [] : [row.modelLabel];
    models.set(normalizedModel.id, { id: normalizedModel.id, name: existingModel?.name ?? normalizedModel.name, provider: existingModel?.provider ?? normalizedModel.provider, aliases });
    const rowHarnesses = [...row.harnesses.map(({ label, kind }) => normalizeHarness(label, kind)), evaluationHarness];
    rowHarnesses.forEach((harness) => {
      const existing = harnesses.get(harness.id);
      harnesses.set(harness.id, existing ? { ...existing, aliases: [...new Set([...existing.aliases, ...harness.aliases])] } : harness);
    });
    return {
      id: `${sourceId}-${normalizedModel.id}-${index + 1}`,
      sourceId,
      benchmarkId: sourceId,
      modelId: normalizedModel.id,
      modelLabel: row.modelLabel,
      harnessIds: rowHarnesses.map(({ id }) => id),
      metrics: row.metrics,
      sourceUrl,
      taskSet: row.taskSet ?? null,
      budget: row.budget ?? null,
      backend: row.backend ?? null,
      defense: row.defense ?? null,
      attack: row.attack ?? null,
      publishedAt: row.publishedAt ?? null,
    };
  });
  return { results, unresolvedModels };
};

async function main(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const previous = await readPrevious();
  const models = new Map<string, Model>();
  const harnesses = new Map<string, Harness>();
  const allResults: Result[] = [];
  const coverage: SourceCoverage[] = [];

  for (const source of sources) {
    if (source.adapter === null) {
      coverage.push({ sourceId: source.id, automated: false, crawlStatus: "not-automated", rowCount: 0, lastAttemptAt: null, lastSuccessAt: null, retainedPrevious: false, fieldCompleteness: 0, unresolvedModels: 0, unresolvedHarnesses: 0, error: null });
      continue;
    }
    try {
      const rawRows = await crawlSource(source);
      if (!rawRows.length) throw new Error("Source returned no result rows");
      const converted = convert(source.id, source.url, rawRows, models, harnesses);
      allResults.push(...converted.results);
      coverage.push({ sourceId: source.id, automated: true, crawlStatus: "success", rowCount: converted.results.length, lastAttemptAt: generatedAt, lastSuccessAt: generatedAt, retainedPrevious: false, fieldCompleteness: fieldCompleteness(converted.results), unresolvedModels: converted.unresolvedModels, unresolvedHarnesses: 0, error: null });
    } catch (error) {
      const retained = previous.results?.results.filter((result) => result.sourceId === source.id) ?? [];
      retained.forEach((result) => allResults.push(result));
      const previousCoverage = previous.coverage?.sources.find((item) => item.sourceId === source.id);
      coverage.push({ sourceId: source.id, automated: true, crawlStatus: retained.length ? "retained" : "failed", rowCount: retained.length, lastAttemptAt: generatedAt, lastSuccessAt: previousCoverage?.lastSuccessAt ?? null, retainedPrevious: retained.length > 0, fieldCompleteness: fieldCompleteness(retained), unresolvedModels: previousCoverage?.unresolvedModels ?? 0, unresolvedHarnesses: previousCoverage?.unresolvedHarnesses ?? 0, error: error instanceof Error ? error.message : "Unknown crawl error" });
    }
  }

  // Rebuild entities for retained rows from the previous catalog when a source failed.
  if (previous.results && allResults.some((row) => coverage.find((item) => item.sourceId === row.sourceId)?.retainedPrevious)) {
    try {
      const oldCatalog = catalogSchema.parse(JSON.parse(await readFile(join(dataDirectory, "catalog.json"), "utf8")));
      oldCatalog.models.forEach((model) => models.set(model.id, models.get(model.id) ?? model));
      oldCatalog.harnesses.forEach((harness) => harnesses.set(harness.id, harnesses.get(harness.id) ?? harness));
    } catch { /* Results still validate referentially below and fail loudly if the old catalog is unusable. */ }
  }

  const catalog: Catalog = {
    generatedAt,
    sources,
    benchmarks: sources.map(({ id, name, category, description }) => ({ id, sourceId: id, name, category, description })),
    models: [...models.values()].sort((a, b) => a.name.localeCompare(b.name)),
    harnesses: [...harnesses.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
  const resultsDocument: ResultsDocument = { generatedAt, results: allResults };
  const modelSources = new Map<string, Set<string>>();
  const harnessSources = new Map<string, Set<string>>();
  allResults.forEach((result) => {
    const sourcesForModel = modelSources.get(result.modelId) ?? new Set<string>();
    sourcesForModel.add(result.sourceId);
    modelSources.set(result.modelId, sourcesForModel);
    result.harnessIds.forEach((id) => {
      const sourcesForHarness = harnessSources.get(id) ?? new Set<string>();
      sourcesForHarness.add(result.sourceId);
      harnessSources.set(id, sourcesForHarness);
    });
  });
  const coverageDocument: Coverage = {
    generatedAt,
    summary: {
      catalogSources: sources.length,
      automatedSources: coverage.filter(({ automated }) => automated).length,
      healthySources: coverage.filter(({ crawlStatus }) => crawlStatus === "success").length,
      resultRows: allResults.length,
      modelOverlap: [...modelSources.values()].filter((sourceIds) => sourceIds.size > 1).length,
      harnessOverlap: [...harnessSources.values()].filter((sourceIds) => sourceIds.size > 1).length,
    },
    sources: coverage,
  };

  catalogSchema.parse(catalog);
  resultsDocumentSchema.parse(resultsDocument);
  coverageSchema.parse(coverageDocument);
  await Promise.all([
    writeFile(join(dataDirectory, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`),
    writeFile(join(dataDirectory, "results.json"), `${JSON.stringify(resultsDocument, null, 2)}\n`),
    writeFile(join(dataDirectory, "coverage.json"), `${JSON.stringify(coverageDocument, null, 2)}\n`),
  ]);
  console.log(`Wrote ${allResults.length} rows from ${coverageDocument.summary.healthySources}/${coverageDocument.summary.automatedSources} automated sources.`);
  coverage.filter(({ error }) => error).forEach(({ sourceId, error, retainedPrevious }) => console.warn(`${sourceId}: ${error}${retainedPrevious ? " (retained previous snapshot)" : ""}`));
}

await main();
