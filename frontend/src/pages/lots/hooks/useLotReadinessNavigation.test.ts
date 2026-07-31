import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefObject } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';

// The hook takes the router's searchParams/setSearchParams pair as params
// (rather than calling useSearchParams itself), so renderHook needs no Router
// wrapper and no module mocks: tests hand it a plain URLSearchParams and a
// vi.fn() setter, then assert the URL payloads the page would push. The only
// environment pieces faked are the window APIs the focus effect touches —
// matchMedia (not implemented in jsdom, stubbed locally per the test README's
// deferred-polyfill note), requestAnimationFrame, and the 3s highlight timer.
import { useLotReadinessNavigation } from './useLotReadinessNavigation';

let prefersReducedMotion = false;

function createPanelElement(): HTMLDivElement {
  const element = document.createElement('div');
  element.scrollIntoView = vi.fn();
  element.focus = vi.fn();
  return element;
}

interface RenderNavigationOptions {
  search?: string;
  element?: HTMLDivElement | null;
}

function renderNavigation({ search = '', element = null }: RenderNavigationOptions = {}) {
  const setSearchParams = vi.fn() as unknown as SetURLSearchParams;
  const tabSectionRef: RefObject<HTMLDivElement> = { current: element };
  const utils = renderHook((props) => useLotReadinessNavigation(props), {
    initialProps: {
      searchParams: new URLSearchParams(search),
      setSearchParams,
      tabSectionRef,
    },
  });
  const lastParams = () => {
    const calls = vi.mocked(setSearchParams).mock.calls;
    return calls.at(-1)?.[0] as URLSearchParams | undefined;
  };
  return { ...utils, setSearchParams: vi.mocked(setSearchParams), tabSectionRef, lastParams };
}

beforeEach(() => {
  prefersReducedMotion = false;
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'],
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: prefersReducedMotion, media: query })),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('URL-derived state', () => {
  it('defaults to the itp tab with no assign action', () => {
    const { result, setSearchParams } = renderNavigation();

    expect(result.current.currentTab).toBe('itp');
    expect(result.current.currentWorkspaceTab).toBe('itp');
    expect(result.current.shouldOpenAssignItp).toBe(false);
    expect(result.current.currentTabLabel).toBe('ITP Checklist');
    expect(result.current.readinessFocusTarget).toBeNull();
    expect(result.current.highlightedReadinessTab).toBeNull();
    // A bare lot URL already means the checklist; don't churn history to say so.
    expect(setSearchParams).not.toHaveBeenCalled();
  });

  it('reads the workspace tab, subview and assign-itp action from the URL', () => {
    const { result } = renderNavigation({
      search: 'tab=evidence&view=photos&action=assign-itp',
    });

    expect(result.current.currentTab).toBe('photos');
    expect(result.current.currentWorkspaceTab).toBe('evidence');
    expect(result.current.currentTabLabel).toBe('Photos');
    expect(result.current.shouldOpenAssignItp).toBe(true);
  });

  it('resolves an unknown tab to the checklist instead of an empty panel', () => {
    const { result } = renderNavigation({ search: 'tab=not-a-tab' });

    expect(result.current.currentTab).toBe('itp');
    expect(result.current.currentTabLabel).toBe('ITP Checklist');
  });
});

describe('legacy URL canonicalization', () => {
  it.each([
    ['tab=photos', 'evidence', 'photos'],
    ['tab=documents', 'evidence', 'documents'],
    ['tab=comments', 'activity', 'comments'],
    ['tab=history', 'activity', 'changes'],
    // The dashboard hold-point alert deep link.
    ['tab=holdpoints', 'itp', null],
    ['tab=nonsense', 'itp', null],
  ])('rewrites ?%s in place with replace semantics', (search, tab, view) => {
    const { setSearchParams, lastParams } = renderNavigation({ search });

    expect(setSearchParams).toHaveBeenCalledWith(expect.any(URLSearchParams), { replace: true });
    expect(lastParams()?.get('tab')).toBe(tab);
    expect(lastParams()?.get('view')).toBe(view);
  });

  it('preserves every other param on a stored mention deep link', () => {
    const { lastParams } = renderNavigation({ search: 'tab=comments&commentId=c-42&foo=bar' });

    const params = lastParams();
    expect(params?.get('tab')).toBe('activity');
    expect(params?.get('view')).toBe('comments');
    expect(params?.get('commentId')).toBe('c-42');
    expect(params?.get('foo')).toBe('bar');
  });

  it('clears a stale view left over from a merged tab', () => {
    const { lastParams } = renderNavigation({ search: 'tab=tests&view=photos' });

    expect(lastParams()?.get('tab')).toBe('tests');
    expect(lastParams()?.has('view')).toBe(false);
  });

  it('leaves an already-canonical URL alone', () => {
    for (const search of ['tab=itp', 'tab=evidence&view=documents', 'tab=activity&view=changes']) {
      const { setSearchParams } = renderNavigation({ search });
      expect(setSearchParams).not.toHaveBeenCalled();
      vi.clearAllMocks();
    }
  });
});

describe('handleTabChange', () => {
  it('writes canonical params, drops the action, and clears readiness focus/highlight', () => {
    const { result, setSearchParams, lastParams } = renderNavigation({
      search: 'tab=itp&action=assign-itp',
    });

    // Seed focus/highlight first so the clearing is observable.
    act(() => {
      result.current.handleReadinessTabChange('tests');
    });
    expect(result.current.highlightedReadinessTab).toBe('tests');

    act(() => {
      result.current.handleTabChange('photos');
    });

    const params = lastParams();
    expect(params?.get('tab')).toBe('evidence');
    expect(params?.get('view')).toBe('photos');
    expect(params?.has('action')).toBe(false);
    // Plain navigation pushes (no replace option), matching the inline code.
    expect(setSearchParams.mock.calls.at(-1)).toHaveLength(1);
    expect(result.current.readinessFocusTarget).toBeNull();
    expect(result.current.highlightedReadinessTab).toBeNull();
  });
});

describe('handleWorkspaceTabChange', () => {
  it('opens Evidence on Photos and Activity on Comments', () => {
    const { result, lastParams } = renderNavigation({ search: 'tab=itp' });

    act(() => {
      result.current.handleWorkspaceTabChange('evidence');
    });
    expect(lastParams()?.get('tab')).toBe('evidence');
    expect(lastParams()?.get('view')).toBe('photos');

    act(() => {
      result.current.handleWorkspaceTabChange('activity');
    });
    expect(lastParams()?.get('tab')).toBe('activity');
    expect(lastParams()?.get('view')).toBe('comments');
  });

  it('drops the view param for the three single tabs', () => {
    const { result, lastParams } = renderNavigation({ search: 'tab=evidence&view=documents' });

    act(() => {
      result.current.handleWorkspaceTabChange('ncrs');
    });

    expect(lastParams()?.get('tab')).toBe('ncrs');
    expect(lastParams()?.has('view')).toBe(false);
  });
});

describe('handleReadinessTabChange', () => {
  it.each(['no_itp_assigned', 'no_itp'])(
    'sets action=assign-itp when targeting the itp tab with %s',
    (actionCode) => {
      const { result, lastParams } = renderNavigation();

      act(() => {
        result.current.handleReadinessTabChange('itp', actionCode);
      });

      const params = lastParams();
      expect(params?.get('tab')).toBe('itp');
      expect(params?.get('action')).toBe('assign-itp');
      expect(result.current.readinessFocusTarget).toEqual({
        tab: 'itp',
        requestedAt: expect.any(Number),
      });
      expect(result.current.highlightedReadinessTab).toBe('itp');
    },
  );

  it('drops any existing action for non-itp tabs and other action codes', () => {
    const { result, lastParams } = renderNavigation({ search: 'action=assign-itp' });

    act(() => {
      result.current.handleReadinessTabChange('tests', 'no_itp_assigned');
    });
    expect(lastParams()?.has('action')).toBe(false);

    act(() => {
      result.current.handleReadinessTabChange('itp', 'missing_evidence');
    });
    expect(lastParams()?.get('tab')).toBe('itp');
    expect(lastParams()?.has('action')).toBe(false);
  });
});

describe('handleAssignItpActionHandled', () => {
  it('removes a consumed assign-itp action with replace semantics', () => {
    const { result, setSearchParams, lastParams } = renderNavigation({
      search: 'tab=itp&action=assign-itp',
    });

    act(() => {
      result.current.handleAssignItpActionHandled();
    });

    expect(setSearchParams).toHaveBeenCalledWith(expect.any(URLSearchParams), { replace: true });
    const params = lastParams();
    expect(params?.get('tab')).toBe('itp');
    expect(params?.has('action')).toBe(false);
  });

  it('does nothing when no assign-itp action is pending', () => {
    const { result, setSearchParams } = renderNavigation({ search: 'tab=itp' });

    act(() => {
      result.current.handleAssignItpActionHandled();
    });

    expect(setSearchParams).not.toHaveBeenCalled();
  });
});

describe('focus and highlight effect', () => {
  it('scrolls and focuses the tab panel one frame after readiness navigation', () => {
    const element = createPanelElement();
    const { result } = renderNavigation({ element });

    act(() => {
      result.current.handleReadinessTabChange('itp');
    });
    expect(element.scrollIntoView).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersToNextFrame();
    });

    expect(element.scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      inline: 'nearest',
      behavior: 'smooth',
    });
    expect(element.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('uses auto scroll behavior when the user prefers reduced motion', () => {
    prefersReducedMotion = true;
    const element = createPanelElement();
    const { result } = renderNavigation({ element });

    act(() => {
      result.current.handleReadinessTabChange('itp');
    });
    act(() => {
      vi.advanceTimersToNextFrame();
    });

    expect(element.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' }),
    );
  });

  it('clears the highlight after the 3s pulse', () => {
    const element = createPanelElement();
    const { result } = renderNavigation({ element });

    act(() => {
      result.current.handleReadinessTabChange('itp');
    });
    expect(result.current.highlightedReadinessTab).toBe('itp');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.highlightedReadinessTab).toBeNull();
  });

  it('waits for the URL tab to match the readiness target before focusing', () => {
    const element = createPanelElement();
    const { result, rerender, setSearchParams, tabSectionRef } = renderNavigation({
      search: 'tab=tests',
      element,
    });

    act(() => {
      result.current.handleReadinessTabChange('photos');
    });
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    // Target tab (photos) differs from the current URL tab (tests): no focus yet.
    expect(element.scrollIntoView).not.toHaveBeenCalled();

    // Simulate the router applying the pushed params.
    rerender({
      searchParams: new URLSearchParams('tab=evidence&view=photos'),
      setSearchParams,
      tabSectionRef,
    });
    act(() => {
      vi.advanceTimersToNextFrame();
    });

    expect(element.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(element.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
