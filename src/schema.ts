import { z } from "zod";

export const categorySchema = z.enum([
  "offensive",
  "defensive",
  "secure-coding",
  "ai-system-security",
  "knowledge",
]);
export type Category = z.infer<typeof categorySchema>;

export const sourceStatusSchema = z.enum(["live", "manual", "stale", "empty", "dead", "blocked"]);
export const adapterSchema = z.enum(["cisco", "cybergym-e2e", "wiz", "sec-bench", "agentdojo", "agent-security-league"]);

export const sourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  category: categorySchema,
  status: sourceStatusSchema,
  adapter: adapterSchema.nullable(),
  description: z.string().min(1),
});
export type Source = z.infer<typeof sourceSchema>;

export const benchmarkSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  name: z.string().min(1),
  category: categorySchema,
  description: z.string().min(1),
});
export type Benchmark = z.infer<typeof benchmarkSchema>;

export const modelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().nullable(),
  aliases: z.array(z.string()),
});
export type Model = z.infer<typeof modelSchema>;

export const harnessSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["agent", "evaluation", "defense"]),
  aliases: z.array(z.string()),
});
export type Harness = z.infer<typeof harnessSchema>;

export const metricSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  displayValue: z.string().min(1),
  unit: z.enum(["percent", "score", "count", "seconds", "text"]),
  direction: z.enum(["higher", "lower", "neutral"]),
});
export type Metric = z.infer<typeof metricSchema>;

export const resultSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  benchmarkId: z.string().min(1),
  modelId: z.string().min(1),
  modelLabel: z.string().min(1),
  harnessIds: z.array(z.string()),
  metrics: z.array(metricSchema).min(1),
  sourceUrl: z.url(),
  taskSet: z.string().nullable(),
  budget: z.string().nullable(),
  backend: z.string().nullable(),
  defense: z.string().nullable(),
  attack: z.string().nullable(),
  publishedAt: z.string().nullable(),
});
export type Result = z.infer<typeof resultSchema>;

export const catalogSchema = z.object({
  generatedAt: z.iso.datetime(),
  sources: z.array(sourceSchema),
  benchmarks: z.array(benchmarkSchema),
  models: z.array(modelSchema),
  harnesses: z.array(harnessSchema),
});
export type Catalog = z.infer<typeof catalogSchema>;

export const resultsDocumentSchema = z.object({
  generatedAt: z.iso.datetime(),
  results: z.array(resultSchema),
});
export type ResultsDocument = z.infer<typeof resultsDocumentSchema>;

export const sourceCoverageSchema = z.object({
  sourceId: z.string().min(1),
  automated: z.boolean(),
  crawlStatus: z.enum(["success", "retained", "not-automated", "failed"]),
  rowCount: z.number().int().nonnegative(),
  lastAttemptAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  retainedPrevious: z.boolean(),
  fieldCompleteness: z.number().min(0).max(1),
  unresolvedModels: z.number().int().nonnegative(),
  unresolvedHarnesses: z.number().int().nonnegative(),
  error: z.string().nullable(),
});
export type SourceCoverage = z.infer<typeof sourceCoverageSchema>;

export const coverageSchema = z.object({
  generatedAt: z.iso.datetime(),
  summary: z.object({
    catalogSources: z.number().int().nonnegative(),
    automatedSources: z.number().int().nonnegative(),
    healthySources: z.number().int().nonnegative(),
    resultRows: z.number().int().nonnegative(),
    modelOverlap: z.number().int().nonnegative(),
    harnessOverlap: z.number().int().nonnegative(),
  }),
  sources: z.array(sourceCoverageSchema),
});
export type Coverage = z.infer<typeof coverageSchema>;

export type DataBundle = { catalog: Catalog; results: ResultsDocument; coverage: Coverage };
