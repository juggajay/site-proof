/**
 * Draw evenly spaced "chainage" survey ticks into a container element.
 *
 * Shared by the survey-night landing and login pages (the chainage strip
 * along the bottom of each). Appends `segments + 1` ticks, every 7th one a
 * major tick labelled `CH 0000`, `CH 0700`, … No-op if the element already
 * has children, so it is safe to call once per mount.
 */
export function renderChainageTicks(el: HTMLElement, segments = 28): void {
  if (el.childElementCount > 0) return;
  const step = el.offsetWidth / segments;
  for (let i = 0; i <= segments; i++) {
    const major = i % 7 === 0;
    const tick = document.createElement('div');
    tick.className = 'tick' + (major ? ' maj' : '');
    tick.style.left = i * step + 'px';
    el.appendChild(tick);
    if (major) {
      const label = document.createElement('div');
      label.className = 'lbl';
      label.style.left = i * step + 'px';
      label.textContent = 'CH ' + String(i * 100).padStart(4, '0');
      el.appendChild(label);
    }
  }
}
