/**
 * Detect whether a WheelEvent came from a trackpad or a mouse wheel.
 *
 * On macOS Chrome/Safari, mouse wheel events have a non-standard
 * `wheelDeltaY` property that is always a multiple of 120.
 * Trackpad events produce non-multiples of 120.
 *
 * Falls back to deltaMode check for other platforms.
 */

export function detectIsTrackpad(e: WheelEvent): boolean {
  // ctrlKey means pinch-to-zoom on trackpad — always "trackpad"
  if (e.ctrlKey) return true;
  // deltaMode 1 or 2 = definitely a mouse (line/page units)
  if (e.deltaMode !== 0) return false;

  // Non-standard but reliable on macOS Chrome/Safari/Electron:
  // Mouse wheel produces wheelDeltaY in multiples of 120
  const wd = (e as any).wheelDeltaY;
  if (wd !== undefined && wd !== 0) {
    return wd % 120 !== 0;
  }

  // If wheelDeltaY is unavailable or zero, check deltaX presence
  // (trackpad two-finger scroll often has lateral component)
  return e.deltaX !== 0;
}
