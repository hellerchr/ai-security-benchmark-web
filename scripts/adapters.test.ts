import { describe, expect, it } from "vitest";
import { parseAgentDojo, parseAgentSecurityLeague, parseCisco, parseCyberGym, parseSecBench, parseWiz, type RawResult } from "./adapters.js";

const cells = (values: string[]): string => values.map((value) => `<td>${value}</td>`).join("");
const values = (row: RawResult | undefined): Record<string, number> => Object.fromEntries(row?.metrics.map(({ name, value }) => [name, value]) ?? []);
const units = (row: RawResult | undefined): Record<string, string> => Object.fromEntries(row?.metrics.map(({ name, unit, direction }) => [name, `${unit}/${direction}`]) ?? []);

describe("parseWiz", () => {
  const table = (...rows: string[]): string => `<table><tbody>${rows.map((row) => `<tr>${row}</tr>`).join("")}</tbody></table>`;

  it("splits the harness span off the model cell and reads every column", () => {
    const [row] = parseWiz(table(cells(["1", "Claude Opus 4.6<span>Claude Code</span>", "49.4%", "84.2%", "41.9%", "35%", "47.6%", "8.2 min"])));
    expect(row?.modelLabel).toBe("Claude Opus 4.6");
    expect(row?.harnesses).toEqual([{ label: "Claude Code", kind: "agent" }]);
    expect(values(row)).toEqual({ "Code vulnerabilities": 49.4, "API security": 84.2, "Web security": 41.9, "Cloud security": 35, Overall: 47.6, "Average time": 8.2 });
  });

  it("drops rows without a model or any numeric metric", () => {
    expect(parseWiz(table(cells(["1", "", "49%"]), cells(["2", "Model", "—", "—", "—", "—", "—", "—"])))).toEqual([]);
  });
});

describe("parseSecBench", () => {
  it("reads success, completed count, provider, harness, and backend", () => {
    const [row] = parseSecBench(`<table id="overall-table"><tbody><tr>${cells(["1", '<span class="model-name-text">GPT-5</span><span class="model-meta">Codex</span>', "58.4%", "330/344", "OpenAI", "API"])}</tr></tbody></table>`);
    expect(row).toMatchObject({ modelLabel: "GPT-5", provider: "OpenAI", backend: "API", harnesses: [{ label: "Codex", kind: "agent" }] });
    expect(values(row)).toEqual({ Success: 58.4, Completed: 330 });
    expect(units(row)).toEqual({ Success: "percent/higher", Completed: "count/higher" });
  });
});

describe("parseAgentDojo", () => {
  const table = (defense: string): string => `<table id="results-table"><tbody><tr>${cells(["anthropic", "claude", defense, "instruction", "88%", "77%", "7%", "2025-01-01"])}</tr></tbody></table>`;

  it("records the defense as a harness and attack success as lower-is-better", () => {
    const [row] = parseAgentDojo(table("Spotlighting"));
    expect(row).toMatchObject({ modelLabel: "claude", provider: "anthropic", defense: "Spotlighting", attack: "instruction", publishedAt: "2025-01-01", harnesses: [{ label: "Spotlighting", kind: "defense" }] });
    expect(values(row)).toEqual({ Utility: 88, "Utility under attack": 77, "Targeted ASR": 7 });
    expect(units(row)["Targeted ASR"]).toBe("percent/lower");
  });

  it("does not turn an undefended run into a defense harness", () => {
    expect(parseAgentDojo(table("None"))[0]?.harnesses).toEqual([]);
  });
});

describe("parseAgentSecurityLeague", () => {
  it("reads agent, model, both scores, and date", () => {
    const block = (content: string): string => `<div class="security-tab-item_block">${content}</div>`;
    const [row] = parseAgentSecurityLeague(`<div fs-list-element="item">${block("1")}${block('<div fs-list-field="agent">Cursor</div>')}${block('<div fs-list-field="model">Claude</div>')}${block("73.7")}${block("32.4")}${block("2026-01-01")}</div>`);
    expect(row).toMatchObject({ modelLabel: "Claude", publishedAt: "2026-01-01", harnesses: [{ label: "Cursor", kind: "agent" }] });
    expect(values(row)).toEqual({ Functional: 73.7, Secure: 32.4 });
  });
});

describe("parseCisco", () => {
  it("scales the pass fraction to a percent and keeps only published fields", () => {
    const [row] = parseCisco({ data: [{ model: "Model A", Pass: 0.915, combined_score: 91 }] });
    expect(values(row)).toEqual({ "Pass rate": 91.5, "Combined score": 91 });
    expect(row?.metrics[0]?.displayValue).toBe("91.5%");
  });

  it("drops models with no metrics and rejects an unexpected payload", () => {
    expect(parseCisco({ data: [{ model: "Model A" }] })).toEqual([]);
    expect(() => parseCisco({ rows: [] })).toThrow();
  });
});

describe("parseCyberGym", () => {
  it("keeps harness, stringified task set, and budget with each level", () => {
    const [row] = parseCyberGym({ results: [{ model: "Model A", harness: "Agent", task_set: 10, budget: "$1", s1: 20, s3: 5 }] });
    expect(row).toMatchObject({ taskSet: "10", budget: "$1", harnesses: [{ label: "Agent", kind: "agent" }] });
    expect(values(row)).toEqual({ S1: 20, S3: 5 });
  });

  it("rejects an unexpected payload", () => {
    expect(() => parseCyberGym({ data: [] })).toThrow();
  });
});
