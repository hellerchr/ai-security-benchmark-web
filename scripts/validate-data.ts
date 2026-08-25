import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { catalogSchema, coverageSchema, resultsDocumentSchema } from "../src/schema.js";

const dataDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const readJson = async (name: string): Promise<unknown> => JSON.parse(await readFile(join(dataDirectory, name), "utf8"));
const [catalog, results, coverage] = await Promise.all([
  readJson("catalog.json").then((value) => catalogSchema.parse(value)),
  readJson("results.json").then((value) => resultsDocumentSchema.parse(value)),
  readJson("coverage.json").then((value) => coverageSchema.parse(value)),
]);

const sourceIds = new Set(catalog.sources.map(({ id }) => id));
const benchmarkIds = new Set(catalog.benchmarks.map(({ id }) => id));
const modelIds = new Set(catalog.models.map(({ id }) => id));
const harnessIds = new Set(catalog.harnesses.map(({ id }) => id));
for (const result of results.results) {
  if (!sourceIds.has(result.sourceId)) throw new Error(`Unknown source ${result.sourceId}`);
  if (!benchmarkIds.has(result.benchmarkId)) throw new Error(`Unknown benchmark ${result.benchmarkId}`);
  if (!modelIds.has(result.modelId)) throw new Error(`Unknown model ${result.modelId}`);
  result.harnessIds.forEach((id) => { if (!harnessIds.has(id)) throw new Error(`Unknown harness ${id}`); });
}
coverage.sources.forEach(({ sourceId }) => { if (!sourceIds.has(sourceId)) throw new Error(`Unknown coverage source ${sourceId}`); });
console.log(`Validated ${catalog.sources.length} sources, ${catalog.models.length} models, ${catalog.harnesses.length} harnesses, and ${results.results.length} results.`);
