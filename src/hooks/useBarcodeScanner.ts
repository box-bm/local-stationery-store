import { useEffect, useRef } from "react";

interface Options {
  /** Called with the scanned code when a scan is detected. */
  onScan: (code: string) => void;
  /** Max ms between keystrokes to still count as part of a scan. */
  maxIntervalMs?: number;
  /** Minimum length to treat buffered input as a barcode. */
  minLength?: number;
  enabled?: boolean;
}

/**
 * Detects USB HID barcode scanners, which type characters rapidly and end
 * with Enter. We buffer keystrokes globally and, if they arrive fast enough
 * and terminate with Enter, treat the buffer as a scanned code.
 *
 * Typing into a focused text input is ignored unless it's clearly a scan
 * (very fast), so manual typing in the search box still works normally.
 */
export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 50,
  minLength = 3,
  enabled = true,
}: Options) {
  const buffer = useRef("");
  const lastTime = useRef(0);

  // Keep the latest onScan without re-binding the listener each render.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const now = Date.now();
      const elapsed = now - lastTime.current;

      if (e.key === "Enter") {
        if (buffer.current.length >= minLength) {
          const code = buffer.current;
          buffer.current = "";
          // Detected a scan: prevent the Enter from submitting forms etc.
          e.preventDefault();
          onScanRef.current(code);
          return;
        }
        buffer.current = "";
        return;
      }

      // Only single printable characters are part of a barcode.
      if (e.key.length === 1) {
        // A gap longer than the threshold means human typing — reset.
        if (elapsed > maxIntervalMs) {
          buffer.current = "";
        }
        buffer.current += e.key;
        lastTime.current = now;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, maxIntervalMs, minLength]);
}
