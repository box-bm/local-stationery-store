import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "./useDebounce";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebounce", () => {
  it("only emits the latest value once the delay has passed", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 200), {
      initialProps: { v: "a" },
    });
    expect(result.current).toBe("a");

    rerender({ v: "ab" });
    act(() => void vi.advanceTimersByTime(150));
    rerender({ v: "abc" });
    act(() => void vi.advanceTimersByTime(150));
    expect(result.current).toBe("a");

    act(() => void vi.advanceTimersByTime(50));
    expect(result.current).toBe("abc");
  });
});
