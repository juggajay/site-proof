import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SignaturePad } from './SignaturePad';

// jsdom has no real 2D canvas; stub getContext + toDataURL so the typed-signature
// path (which renders text onto the canvas and exports a dataURL) can run.
const TYPED_DATA_URL = 'data:image/png;base64,TYPED-SIGNATURE';

function stubCanvas() {
  const ctx = new Proxy(
    {},
    {
      get: () => vi.fn(),
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(TYPED_DATA_URL);
}

describe('SignaturePad typed mode', () => {
  beforeEach(() => {
    stubCanvas();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('switches to Type mode and emits a dataURL from the typed full name', () => {
    const onChange = vi.fn();
    render(<SignaturePad onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /type/i }));
    expect(screen.getByRole('button', { name: /type/i })).toHaveAttribute('aria-pressed', 'true');

    const input = screen.getByPlaceholderText('Type your full name');
    fireEvent.change(input, { target: { value: 'Jordan Surveyor' } });

    expect(onChange).toHaveBeenLastCalledWith(TYPED_DATA_URL);
    expect(screen.getByText('Signed electronically')).toBeInTheDocument();
  });

  it('emits null when the typed name is empty (disabled-submit state upstream)', () => {
    const onChange = vi.fn();
    render(<SignaturePad onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /type/i }));
    const input = screen.getByPlaceholderText('Type your full name');

    fireEvent.change(input, { target: { value: 'Sam' } });
    expect(onChange).toHaveBeenLastCalledWith(TYPED_DATA_URL);

    fireEvent.change(input, { target: { value: '   ' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('disables the mode toggle when disabled', () => {
    render(<SignaturePad onChange={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: /draw/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /type/i })).toBeDisabled();
  });
});
