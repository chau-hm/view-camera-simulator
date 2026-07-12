import { render, screen } from '@testing-library/react';
import { describe, it, afterEach, expect } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from '../../app/router';

function mockMatchMedia(matches: Record<string, boolean>) {
  // @ts-expect-error - mocking window.matchMedia for JSDOM
  window.matchMedia = (query: string) => ({ matches: !!matches[query], media: query, addEventListener: () => {}, removeEventListener: () => {} });
}

describe('marketing desktop experience notice', () => {
  const memoryRouter = createMemoryRouter(routes, { initialEntries: ['/'] });

  afterEach(() => {
    // restore
    // @ts-expect-error - cleanup mock
    delete window.matchMedia;
  });

  it('does not show notice on wide desktop', async () => {
    // wide desktop
    (window as unknown as { innerWidth: number }).innerWidth = 1280;
    mockMatchMedia({ '(max-width: 899px)': false, '(pointer: coarse)': false });

    render(<RouterProvider router={memoryRouter} />);

    expect(await screen.findByText('Open Focus Fundamentals')).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('shows notice on narrow viewport and retains CTA', async () => {
    (window as unknown as { innerWidth: number }).innerWidth = 390;
    mockMatchMedia({ '(max-width: 899px)': true, '(pointer: coarse)': true });

    const narrowRouter = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={narrowRouter} />);

    const note = await screen.findByRole('note');
    expect(note).toBeInTheDocument();
    const ctas = await screen.findAllByText('Open Focus Fundamentals');
    expect(ctas.length).toBeGreaterThanOrEqual(1);
  });
});
