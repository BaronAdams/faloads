import { describe, it, expect } from "vitest";
import { descentArea, descentDefaults, descentSchema } from "./descent";
import { descent } from "./engineering";
import { workspaceSchema, freshWorkspace } from "@/lib/storage";
describe("Full influence lengths and existing studies", () => {
  it("uses the complete four influence lengths for a new column study", () => {
    const model = descentDefaults("column-load");
    expect(descentArea(model)).toBe(36);
    model.spans = [2, 4, 3, 5];
    expect(descentArea(model)).toBe(48);
    model.spans = [0, 4, 0, 5];
    expect(descentArea(model)).toBe(20);
  });
  it("migrates old column lengths once, retaining effective area and efforts", () => {
    const { tributaryConvention: _, ...old } = descentDefaults("column-load");
    const model = descentSchema.parse(old);
    expect(model.spans).toEqual([1.5, 1.5, 1.5, 1.5]);
    expect(descentArea(model)).toBe(9);
    expect(descentSchema.parse(model)).toEqual(model);
    expect(descent(model.levels, descentArea(model), 0, false)).toEqual(
      descent(old.levels, 9, 0, false),
    );
  });
  it("keeps the wall tributary-width convention", () => {
    const { tributaryConvention: _, ...old } = descentDefaults("wall-load");
    const model = descentSchema.parse(old);
    expect(model.spans).toEqual(old.spans);
    expect(descentArea(model)).toBe(12);
  });
  it("loads old workspaces and retains separate guide completion for each type", () => {
    const { guides: _, ...old } = freshWorkspace();
    const workspace = workspaceSchema.parse(old);
    expect(workspace.guides).toEqual({});
    workspace.guides.beam = { step: 8, completed: true };
    const restored = workspaceSchema.parse(
      JSON.parse(JSON.stringify(workspace)),
    );
    expect(restored.guides.beam.completed).toBe(true);
    expect(restored.guides.frame).toBeUndefined();
  });
});
