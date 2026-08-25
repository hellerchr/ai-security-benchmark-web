import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useParams } from "react-router-dom";
import { loadData } from "./data";
import type { Benchmark, Category, DataBundle, Harness, Result, Source } from "./schema";

const categoryNames: Record<Category, string> = {
  offensive: "Offensive",
  defensive: "Defensive",
  "secure-coding": "Secure coding",
  "ai-system-security": "AI system security",
  knowledge: "Knowledge",
};

const dateTime = (value: string): string => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
const percent = (value: number): string => `${Math.round(value * 100)}%`;

function Header(): ReactNode {
  return <>
    <header className="site-header">
      <Link className="brand" to="/overview"><span className="brand-mark">AS</span><span>AI Security Index<small>Benchmark browser</small></span></Link>
      <nav aria-label="Primary navigation">
        {["Overview", "Benchmarks", "Models", "Harnesses", "Sources"].map((item) => <NavLink key={item} to={`/${item.toLowerCase()}`}>{item}</NavLink>)}
      </nav>
      <a className="github-link" href="https://github.com/hellerchr/ai-security-benchmark-web">GitHub ↗</a>
    </header>
  </>;
}

function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }): ReactNode {
  return <div className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{children}</p></div></div>;
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }): ReactNode {
  return <label className="search"><span className="sr-only">{placeholder}</span><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function Status({ status }: { status: Source["status"] | "success" | "retained" | "failed" | "not-automated" }): ReactNode {
  return <span className={`status status-${status}`}>{status.replace("not-automated", "not automated")}</span>;
}

function ResultsTable({ bundle, rows }: { bundle: DataBundle; rows: Result[] }): ReactNode {
  const models = new Map(bundle.catalog.models.map((model) => [model.id, model]));
  const harnesses = new Map(bundle.catalog.harnesses.map((harness) => [harness.id, harness]));
  const sources = new Map(bundle.catalog.sources.map((source) => [source.id, source]));
  if (!rows.length) return <div className="empty"><strong>No normalized result rows.</strong><span>The source is cataloged, but its leaderboard is not automated yet.</span></div>;
  return <div className="table-wrap"><table>
    <thead><tr><th>Model</th><th>Harness configuration</th><th>Benchmark</th><th>Published metrics</th><th>Context</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id}>
      <td><Link className="entity-link" to={`/models/${row.modelId}`}>{models.get(row.modelId)?.name ?? row.modelLabel}</Link><small>{models.get(row.modelId)?.provider ?? "Provider unresolved"}</small></td>
      <td><div className="tag-list">{row.harnessIds.map((id) => <Link className="tag" to={`/harnesses/${id}`} key={id}>{harnesses.get(id)?.name ?? id}</Link>)}</div></td>
      <td><Link className="entity-link" to={`/benchmarks/${row.benchmarkId}`}>{sources.get(row.sourceId)?.name ?? row.sourceId}</Link></td>
      <td><div className="metrics">{row.metrics.map((metric) => <span key={metric.name}><b>{metric.displayValue}</b>{metric.name}</span>)}</div></td>
      <td><div className="context">{row.taskSet && <span>Task set {row.taskSet}</span>}{row.budget && <span>{row.budget}</span>}{row.backend && <span>Backend: {row.backend}</span>}{row.defense && <span>Defense: {row.defense}</span>}{row.attack && <span>Attack: {row.attack}</span>}{row.publishedAt && <span>{row.publishedAt}</span>}</div></td>
    </tr>)}</tbody>
  </table></div>;
}

function Overview({ bundle }: { bundle: DataBundle }): ReactNode {
  const summary = bundle.coverage.summary;
  const automated = bundle.coverage.sources.filter((source) => source.automated);
  return <>
    <section className="hero">
      <p className="eyebrow">Evidence, not a blended score</p>
      <h1>Which models and harnesses perform best on AI cybersecurity benchmarks?</h1>
      <p>Browse original published results by benchmark, model, agent harness, evaluation harness, and defense. Metrics remain in their source-defined context.</p>
      <div className="hero-actions"><Link className="button" to="/benchmarks">Explore benchmarks</Link><Link className="button button-secondary" to="/harnesses">Compare harness evidence</Link></div>
    </section>
    <section className="kpis" aria-label="Dataset summary">
      <article><span>Catalog</span><b>{summary.catalogSources}</b><small>known result sources</small></article>
      <article><span>Automated</span><b>{summary.automatedSources}</b><small>source adapters</small></article>
      <article><span>Snapshot</span><b>{summary.resultRows}</b><small>published result rows</small></article>
      <article><span>Entities</span><b>{bundle.catalog.models.length} / {bundle.catalog.harnesses.length}</b><small>models / harnesses</small></article>
    </section>
    <section className="notice"><b>Coverage is the product question.</b><span>{summary.automatedSources} of {summary.catalogSources} cataloged sources are normalized today. A missing row means “not ingested,” not “poor performance.”</span><Link to="/sources">Inspect coverage →</Link></section>
    <section className="section-head"><div><p className="eyebrow">Pipeline health</p><h2>Automated leaderboards</h2></div><span>Snapshot {dateTime(bundle.coverage.generatedAt)} UTC</span></section>
    <div className="table-wrap"><table><thead><tr><th>Source</th><th>Category</th><th>Rows</th><th>Field completeness</th><th>Identity gaps</th><th>Health</th></tr></thead><tbody>
      {automated.map((item) => {
        const source = bundle.catalog.sources.find(({ id }) => id === item.sourceId);
        return <tr key={item.sourceId}><td><Link className="entity-link" to={`/sources/${item.sourceId}`}>{source?.name}</Link></td><td>{source ? categoryNames[source.category] : "—"}</td><td className="number">{item.rowCount}</td><td><div className="bar"><i style={{ width: percent(item.fieldCompleteness) }} /></div><small>{percent(item.fieldCompleteness)}</small></td><td>{item.unresolvedModels} models · {item.unresolvedHarnesses} harnesses</td><td><Status status={item.crawlStatus} /></td></tr>;
      })}
    </tbody></table></div>
    <section className="method"><p className="eyebrow">Reading the browser</p><h2>No universal winner is implied</h2><div><p>CyberGym patch rates, AgentDojo attack-success rates, and Cisco resistance scores measure different things. This browser makes configurations and overlap visible without pretending those values share a common scale.</p><p>Harnesses are typed as <b>agent</b>, <b>evaluation</b>, or <b>defense</b>. Compare evidence only where the same benchmark, task set, budget, and metric support it.</p></div></section>
  </>;
}

function BenchmarksPage({ bundle }: { bundle: DataBundle }): ReactNode {
  const [query, setQuery] = useState("");
  const rows = bundle.catalog.benchmarks.filter((benchmark) => `${benchmark.name} ${benchmark.description} ${benchmark.category}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeader eyebrow="Benchmark directory" title="Cybersecurity benchmarks">Find the result boards, task categories, configurations, and current ingestion status behind each benchmark.</PageHeader><Search value={query} onChange={setQuery} placeholder="Search benchmarks" /><div className="table-wrap"><table><thead><tr><th>Benchmark</th><th>Category</th><th>Published rows</th><th>Models</th><th>Harnesses</th><th>Source status</th></tr></thead><tbody>{rows.map((benchmark) => {
    const results = bundle.results.results.filter(({ benchmarkId }) => benchmarkId === benchmark.id);
    const source = bundle.catalog.sources.find(({ id }) => id === benchmark.sourceId);
    return <tr key={benchmark.id}><td><Link className="entity-link" to={`/benchmarks/${benchmark.id}`}>{benchmark.name}</Link><small>{benchmark.description}</small></td><td>{categoryNames[benchmark.category]}</td><td className="number">{results.length}</td><td>{new Set(results.map(({ modelId }) => modelId)).size}</td><td>{new Set(results.flatMap(({ harnessIds }) => harnessIds)).size}</td><td>{source && <Status status={source.status} />}</td></tr>;
  })}</tbody></table></div></>;
}

function ModelsPage({ bundle }: { bundle: DataBundle }): ReactNode {
  const [query, setQuery] = useState("");
  const rows = bundle.catalog.models.filter((model) => `${model.name} ${model.provider ?? ""}`.toLowerCase().includes(query.toLowerCase())).map((model) => ({ model, results: bundle.results.results.filter(({ modelId }) => modelId === model.id) })).sort((a, b) => b.results.length - a.results.length);
  return <><PageHeader eyebrow="Model evidence" title="Models">See where each model appears and which harness configurations produced its published results.</PageHeader><Search value={query} onChange={setQuery} placeholder="Search models or providers" /><div className="table-wrap"><table><thead><tr><th>Model</th><th>Provider</th><th>Result rows</th><th>Benchmarks</th><th>Agent / defense harnesses</th></tr></thead><tbody>{rows.map(({ model, results }) => <tr key={model.id}><td><Link className="entity-link" to={`/models/${model.id}`}>{model.name}</Link></td><td>{model.provider ?? <span className="muted">Unresolved</span>}</td><td className="number">{results.length}</td><td>{new Set(results.map(({ benchmarkId }) => benchmarkId)).size}</td><td>{new Set(results.flatMap(({ harnessIds }) => harnessIds).filter((id) => bundle.catalog.harnesses.find((harness) => harness.id === id)?.kind !== "evaluation")).size}</td></tr>)}</tbody></table></div></>;
}

function HarnessesPage({ bundle }: { bundle: DataBundle }): ReactNode {
  const [query, setQuery] = useState("");
  const rows = bundle.catalog.harnesses.filter((harness) => `${harness.name} ${harness.kind}`.toLowerCase().includes(query.toLowerCase())).map((harness) => ({ harness, results: bundle.results.results.filter(({ harnessIds }) => harnessIds.includes(harness.id)) })).sort((a, b) => b.results.length - a.results.length);
  return <><PageHeader eyebrow="Harness evidence" title="Harnesses">Separate model capability from the agent, evaluator, or defense configuration wrapped around it.</PageHeader><div className="callout"><b>Three harness types</b><span><b>Agent</b> runs the model and tools. <b>Evaluation</b> defines tasks and scoring. <b>Defense</b> changes the agent’s security posture.</span></div><Search value={query} onChange={setQuery} placeholder="Search harnesses" /><div className="table-wrap"><table><thead><tr><th>Harness</th><th>Type</th><th>Result rows</th><th>Models</th><th>Benchmarks</th><th>Cross-source evidence</th></tr></thead><tbody>{rows.map(({ harness, results }) => {
    const sources = new Set(results.map(({ sourceId }) => sourceId));
    return <tr key={harness.id}><td><Link className="entity-link" to={`/harnesses/${harness.id}`}>{harness.name}</Link></td><td><span className={`kind kind-${harness.kind}`}>{harness.kind}</span></td><td className="number">{results.length}</td><td>{new Set(results.map(({ modelId }) => modelId)).size}</td><td>{new Set(results.map(({ benchmarkId }) => benchmarkId)).size}</td><td>{sources.size > 1 ? `${sources.size} sources` : <span className="muted">Single source</span>}</td></tr>;
  })}</tbody></table></div></>;
}

function SourcesPage({ bundle }: { bundle: DataBundle }): ReactNode {
  const [query, setQuery] = useState("");
  const rows = bundle.catalog.sources.filter((source) => `${source.name} ${source.publisher} ${source.category} ${source.status}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeader eyebrow="Completeness audit" title="Sources">The full catalog distinguishes known public result sites from sources that are automated, manual, stale, empty, or unavailable.</PageHeader><Search value={query} onChange={setQuery} placeholder="Search sources, publishers, or status" /><div className="table-wrap"><table><thead><tr><th>Source</th><th>Category</th><th>Catalog status</th><th>Ingestion</th><th>Rows</th><th>Last success</th></tr></thead><tbody>{rows.map((source) => {
    const coverage = bundle.coverage.sources.find(({ sourceId }) => sourceId === source.id);
    return <tr key={source.id}><td><Link className="entity-link" to={`/sources/${source.id}`}>{source.name}</Link><small>{source.publisher}</small></td><td>{categoryNames[source.category]}</td><td><Status status={source.status} /></td><td>{coverage && <Status status={coverage.crawlStatus} />}</td><td className="number">{coverage?.rowCount ?? 0}</td><td>{coverage?.lastSuccessAt ? dateTime(coverage.lastSuccessAt) : <span className="muted">Not ingested</span>}</td></tr>;
  })}</tbody></table></div></>;
}

function DetailPage({ bundle, kind }: { bundle: DataBundle; kind: "benchmarks" | "models" | "harnesses" | "sources" }): ReactNode {
  const { id = "" } = useParams();
  let title = "Unknown entity";
  let eyebrow = kind.slice(0, -1);
  let description = "No description available.";
  let rows: Result[] = [];
  let externalUrl: string | null = null;
  if (kind === "benchmarks") {
    const item = bundle.catalog.benchmarks.find((benchmark) => benchmark.id === id);
    if (item) { title = item.name; description = item.description; rows = bundle.results.results.filter(({ benchmarkId }) => benchmarkId === id); }
  } else if (kind === "models") {
    const item = bundle.catalog.models.find((model) => model.id === id);
    if (item) { title = item.name; description = `${item.provider ?? "Provider unresolved"} · ${item.aliases.length ? `Aliases: ${item.aliases.join(", ")}` : "No source aliases"}`; rows = bundle.results.results.filter(({ modelId }) => modelId === id); }
  } else if (kind === "harnesses") {
    const item = bundle.catalog.harnesses.find((harness) => harness.id === id);
    if (item) { title = item.name; eyebrow = `${item.kind} harness`; description = `Published evidence involving this ${item.kind} harness. Results remain grouped by their original benchmark context.`; rows = bundle.results.results.filter(({ harnessIds }) => harnessIds.includes(id)); }
  } else {
    const item = bundle.catalog.sources.find((source) => source.id === id);
    if (item) { title = item.name; description = item.description; rows = bundle.results.results.filter(({ sourceId }) => sourceId === id); externalUrl = item.url; }
  }
  return <><div className="breadcrumbs"><Link to={`/${kind}`}>← All {kind}</Link></div><PageHeader eyebrow={eyebrow} title={title}>{description}</PageHeader><div className="detail-stats"><span><b>{rows.length}</b> result rows</span><span><b>{new Set(rows.map(({ modelId }) => modelId)).size}</b> models</span><span><b>{new Set(rows.flatMap(({ harnessIds }) => harnessIds)).size}</b> harnesses</span>{externalUrl && <a href={externalUrl}>Open original source ↗</a>}</div><ResultsTable bundle={bundle} rows={rows} /></>;
}

export default function App(): ReactNode {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadData().then(setBundle).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load benchmark data")); }, []);
  const content = useMemo(() => {
    if (error) return <main><div className="load-state"><b>Data validation failed</b><span>{error}</span></div></main>;
    if (!bundle) return <main><div className="load-state"><span className="spinner" />Loading validated snapshot…</div></main>;
    return <main><Routes>
      <Route path="/overview" element={<Overview bundle={bundle} />} />
      <Route path="/benchmarks" element={<BenchmarksPage bundle={bundle} />} />
      <Route path="/models" element={<ModelsPage bundle={bundle} />} />
      <Route path="/harnesses" element={<HarnessesPage bundle={bundle} />} />
      <Route path="/sources" element={<SourcesPage bundle={bundle} />} />
      {(["benchmarks", "models", "harnesses", "sources"] as const).map((kind) => <Route key={kind} path={`/${kind}/:id`} element={<DetailPage bundle={bundle} kind={kind} />} />)}
      <Route path="*" element={<Navigate replace to="/overview" />} />
    </Routes></main>;
  }, [bundle, error]);
  return <div className="app"><Header />{content}<footer><span>AI Security Index · source-faithful benchmark evidence</span><span>Data is informational, not a safety certification.</span></footer></div>;
}
