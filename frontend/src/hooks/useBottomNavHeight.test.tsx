// The bottom nav publishes its measured height as a CSS variable on <html>
// so the offline sync pill (.above-bottom-nav in index.css) can float above
// the nav instead of covering the rightmost tab. These tests lock in the
// publish / live-update / cleanup contract of that seam.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BOTTOM_NAV_HEIGHT_VAR, usePublishBottomNavHeight } from './useBottomNavHeight';

function NavProbe() {
  const ref = usePublishBottomNavHeight<HTMLDivElement>();
  return <div ref={ref} />;
}

type ResizeCallback = () => void;

// Minimal ResizeObserver stand-in: jsdom does not implement it, and the hook
// must keep working (initial publish only) when it is absent.
class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  observed: Element[] = [];
  disconnected = false;

  constructor(private callback: ResizeCallback) {
    ResizeObserverStub.instances.push(this);
  }

  observe(el: Element) {
    this.observed.push(el);
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
  }

  fire() {
    this.callback();
  }
}

function readPublishedHeight() {
  return document.documentElement.style.getPropertyValue(BOTTOM_NAV_HEIGHT_VAR);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  ResizeObserverStub.instances = [];
  document.documentElement.style.removeProperty(BOTTOM_NAV_HEIGHT_VAR);
});

describe('usePublishBottomNavHeight', () => {
  it('publishes the nav height under the CSS variable name index.css consumes', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(88);

    render(<NavProbe />);

    // The literal name is load-bearing: .above-bottom-nav in index.css reads it.
    expect(BOTTOM_NAV_HEIGHT_VAR).toBe('--bottom-nav-height');
    expect(readPublishedHeight()).toBe('88px');
  });

  it('still publishes the initial height when ResizeObserver is unavailable (jsdom)', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(64);

    expect(typeof ResizeObserver).toBe('undefined');
    render(<NavProbe />);

    expect(readPublishedHeight()).toBe('64px');
  });

  it('republishes when the observed nav resizes (e.g. md:hidden collapses it to 0)', () => {
    let height = 96;
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => height);
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);

    render(<NavProbe />);

    const observer = ResizeObserverStub.instances[0];
    expect(observer.observed).toHaveLength(1);
    expect(readPublishedHeight()).toBe('96px');

    height = 0;
    observer.fire();

    expect(readPublishedHeight()).toBe('0px');
  });

  it('removes the variable and disconnects the observer on unmount', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(72);
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);

    const { unmount } = render(<NavProbe />);
    expect(readPublishedHeight()).toBe('72px');

    unmount();

    expect(readPublishedHeight()).toBe('');
    expect(ResizeObserverStub.instances[0].disconnected).toBe(true);
  });
});
