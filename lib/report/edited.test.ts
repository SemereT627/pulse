import { describe, expect, it } from "vitest";
import { editedModel, isEdited } from "./edited";

describe("edited summary labels", () => {
  it("marks an AI summary as edited once", () => {
    expect(editedModel("Groq · openai/gpt-oss-120b")).toBe("Groq · openai/gpt-oss-120b · edited");
    expect(editedModel("Groq · openai/gpt-oss-120b · edited")).toBe("Groq · openai/gpt-oss-120b · edited");
  });

  it("labels a summary written from scratch", () => {
    expect(editedModel(null)).toBe("Written by you");
    expect(isEdited("Written by you")).toBe(true);
  });

  it("treats untouched AI output and no summary as not edited", () => {
    expect(isEdited("Groq · openai/gpt-oss-120b")).toBe(false);
    expect(isEdited(null)).toBe(false);
  });
});
