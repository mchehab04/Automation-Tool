/**
 * Replays the .t-input shake keyframe (transitions-dev, 12-error-state-shake)
 * by toggling .is-shaking with a forced reflow in between, so the animation
 * restarts even if the field is already mid-shake. Call with a ref's
 * `.current` from an event handler — not a hook, so it stays a direct
 * `useRef()` at each call site (required for the react-compiler ref rules).
 */
export function replayShake(el: HTMLElement | null) {
  if (!el) return;
  el.classList.remove("is-shaking");
  void el.offsetWidth;
  el.classList.add("is-shaking");
}
