import { describe, expect, it } from "vitest";
import { parseAgentDojo, parseAgentSecurityLeague, parseCisco, parseCyberGym, parseSecBench, parseWiz } from "./adapters.js";

describe("source adapters", () => {
  it("preserves model, harness, and metric identities", () => {
    const wiz = parseWiz("<table><tbody><tr><td>1</td><td>Claude Opus 4.6<span>Claude Code</span></td><td>49.4%</td><td>84.2%</td><td>41.9%</td><td>35%</td><td>47.6%</td><td>8.2 min</td></tr></tbody></table>");
    const sec = parseSecBench('<table id="overall-table"><tbody><tr><td>1</td><td><span class="model-name-text">GPT-5</span><span class="model-meta">Codex</span></td><td>58.4%</td><td>330/344</td><td>OpenAI</td><td>API</td></tr></tbody></table>');
    const dojo = parseAgentDojo('<table id="results-table"><tbody><tr><td>anthropic</td><td>claude</td><td>Spotlighting</td><td>instruction</td><td>88%</td><td>77%</td><td>7%</td><td>2025-01-01</td></tr></tbody></table>');
    const league = parseAgentSecurityLeague('<div fs-list-element="item"><div class="security-tab-item_block">1</div><div class="security-tab-item_block"><div fs-list-field="agent">Cursor</div></div><div class="security-tab-item_block"><div fs-list-field="model">Claude</div></div><div class="security-tab-item_block">73.7</div><div class="security-tab-item_block">32.4</div><div class="security-tab-item_block">2026-01-01</div></div>');
    expect(wiz[0]?.harnesses[0]?.label).toBe("Claude Code");
    expect(sec[0]?.modelLabel).toBe("GPT-5");
    expect(dojo[0]?.harnesses[0]?.kind).toBe("defense");
    expect(league[0]?.metrics[1]?.value).toBe(32.4);
  });

  it("validates JSON sources", () => {
    expect(parseCisco({ data: [{ model: "Model A", combined_score: 91 }] })[0]?.metrics[0]?.value).toBe(91);
    expect(parseCyberGym({ results: [{ model: "Model A", harness: "Agent", task_set: 10, budget: "$1", s1: 20 }] })[0]?.taskSet).toBe("10");
    expect(() => parseCisco({ rows: [] })).toThrow();
  });
});
