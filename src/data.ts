import { catalogSchema, coverageSchema, resultsDocumentSchema, type DataBundle } from "./schema";

const read = async (name: string): Promise<unknown> => {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!response.ok) throw new Error(`Could not load ${name} (${response.status})`);
  return response.json();
};

export async function loadData(): Promise<DataBundle> {
  const [catalog, results, coverage] = await Promise.all([
    read("catalog.json").then((value) => catalogSchema.parse(value)),
    read("results.json").then((value) => resultsDocumentSchema.parse(value)),
    read("coverage.json").then((value) => coverageSchema.parse(value)),
  ]);
  return { catalog, results, coverage };
}
