import { describe, expect, it } from "vitest";
import { systemPrompt } from "./summary";

describe("systemPrompt", () => {
  it("reflects tone and length", () => {
    const p = systemPrompt({ aiTone: "concise", aiLength: "short", aiInstructions: null });
    expect(p).toContain("plain and to the point");
    expect(p).toContain("1-2 short paragraphs");
    expect(p).not.toContain("Additional instructions");
  });

  it("appends the engineer's own instructions, ignoring blank ones", () => {
    expect(systemPrompt({ aiTone: "professional", aiLength: "medium", aiInstructions: "  " })).not.toContain(
      "Additional instructions",
    );
    expect(systemPrompt({ aiTone: "professional", aiLength: "medium", aiInstructions: "Mention OmniFleet by name." })).toContain(
      "Mention OmniFleet by name.",
    );
  });
});
