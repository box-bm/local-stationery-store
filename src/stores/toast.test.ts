import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useToastStore, toast } from "./toast";

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => vi.useRealTimers());

describe("toast store", () => {
  it("helpers push toasts with the right variant", () => {
    toast.success("ok");
    toast.error("err");
    toast.warning("warn");
    toast.info("info");
    expect(useToastStore.getState().toasts.map((t) => [t.message, t.variant])).toEqual([
      ["ok", "success"],
      ["err", "error"],
      ["warn", "warning"],
      ["info", "default"],
    ]);
  });

  it("assigns unique ids", () => {
    toast.info("a");
    toast.info("b");
    const [a, b] = useToastStore.getState().toasts;
    expect(a.id).not.toBe(b.id);
  });

  it("auto-dismisses after 3.5s", () => {
    toast.info("bye");
    vi.advanceTimersByTime(3499);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("dismiss removes only the given toast", () => {
    toast.info("a");
    toast.info("b");
    const [a] = useToastStore.getState().toasts;
    useToastStore.getState().dismiss(a.id);
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(["b"]);
  });
});
