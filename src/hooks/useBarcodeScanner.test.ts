import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBarcodeScanner } from "./useBarcodeScanner";

function press(key: string) {
  const e = new KeyboardEvent("keydown", { key, cancelable: true });
  window.dispatchEvent(e);
  return e;
}

/** Types `text` with `gapMs` between keystrokes, then Enter. */
function type(text: string, gapMs: number) {
  for (const ch of text) {
    vi.advanceTimersByTime(gapMs);
    press(ch);
  }
  vi.advanceTimersByTime(gapMs);
  return press("Enter");
}

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

describe("useBarcodeScanner", () => {
  it("detects fast input ending in Enter as a scan and blocks the Enter", () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));
    const enter = type("7401234567890", 5);
    expect(onScan).toHaveBeenCalledWith("7401234567890");
    expect(enter.defaultPrevented).toBe(true);
  });

  it("ignores slow, human typing", () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));
    const enter = type("abc123", 200);
    expect(onScan).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);
  });

  it("ignores codes shorter than minLength", () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, minLength: 4 }));
    type("123", 5);
    expect(onScan).not.toHaveBeenCalled();
  });

  it("ignores non-printable keys inside a scan", () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));
    press("1");
    press("Shift");
    press("2");
    press("3");
    press("Enter");
    expect(onScan).toHaveBeenCalledWith("123");
  });

  it("does nothing when disabled and stops listening on unmount", () => {
    const onScan = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useBarcodeScanner({ onScan, enabled }),
      { initialProps: { enabled: false } }
    );
    type("12345", 5);
    expect(onScan).not.toHaveBeenCalled();

    rerender({ enabled: true });
    type("12345", 5);
    expect(onScan).toHaveBeenCalledTimes(1);

    unmount();
    type("12345", 5);
    expect(onScan).toHaveBeenCalledTimes(1);
  });
});
