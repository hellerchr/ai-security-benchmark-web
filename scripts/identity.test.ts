import { describe, expect, it } from "vitest";
import { normalizeHarness, normalizeModel, slug } from "./identity.js";

describe("model identity", () => {
  it("strips a known provider prefix and keeps the provider", () => {
    expect(normalizeModel("Anthropic Claude Opus 4.6", null)).toEqual({ id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "Anthropic", resolved: true });
  });

  it("prefers the source's provider and flags models with none as unresolved", () => {
    expect(normalizeModel("GPT-5", "OpenAI")).toMatchObject({ id: "gpt-5", provider: "OpenAI", resolved: true });
    expect(normalizeModel("Mystery 1", null)).toMatchObject({ provider: null, resolved: false });
  });

  it("never merges near-miss names", () => {
    expect(normalizeModel("Claude Opus 4.6", null).id).not.toBe(normalizeModel("Claude Opus 4.5", null).id);
    expect(normalizeModel("GPT-5", null).id).not.toBe(normalizeModel("GPT-5 mini", null).id);
  });
});

describe("harness identity", () => {
  it("maps exact aliases to one canonical harness and records the alias", () => {
    expect(normalizeHarness("claudecode", "agent")).toEqual({ id: "agent-claude-code", name: "Claude Code", kind: "agent", aliases: ["claudecode"] });
    expect(normalizeHarness("Claude Code", "agent")).toEqual({ id: "agent-claude-code", name: "Claude Code", kind: "agent", aliases: [] });
  });

  it("keeps unknown harnesses and harness kinds distinct", () => {
    expect(normalizeHarness("OpenHands Pro", "agent").id).toBe("agent-openhands-pro");
    expect(normalizeHarness("Spotlighting", "defense").id).not.toBe(normalizeHarness("Spotlighting", "agent").id);
  });
});

it("slugs punctuation to stable ids", () => {
  expect(slug(" Gemini 2.5 Pro! ")).toBe("gemini-2-5-pro");
});
