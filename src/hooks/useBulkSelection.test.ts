import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBulkSelection } from "./useBulkSelection";

describe("useBulkSelection", () => {
  it("selects only visible items and reports partial selection", () => {
    const { result } = renderHook(() =>
      useBulkSelection([{ id: "one" }, { id: "two" }]),
    );

    act(() => result.current.toggleOne("one", true));

    expect(result.current.someVisibleSelected).toBe(true);
    expect(result.current.allVisibleSelected).toBe(false);

    act(() => result.current.toggleAllVisible(true));

    expect(result.current.allVisibleSelected).toBe(true);
    expect(Array.from(result.current.selectedIds)).toEqual(["one", "two"]);
  });

  it("keeps selections from other pages when selecting or clearing the visible page", () => {
    const { result, rerender } = renderHook(
      ({ visibleItems }) => useBulkSelection(visibleItems),
      { initialProps: { visibleItems: [{ id: "page-one" }] } },
    );

    act(() => result.current.toggleOne("page-one", true));
    rerender({ visibleItems: [{ id: "page-two" }] });
    act(() => result.current.toggleAllVisible(true));

    expect(Array.from(result.current.selectedIds)).toEqual(["page-one", "page-two"]);

    act(() => result.current.toggleAllVisible(false));

    expect(Array.from(result.current.selectedIds)).toEqual(["page-one"]);
  });
});
