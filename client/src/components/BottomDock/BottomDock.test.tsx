import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { BottomDock } from './BottomDock';

afterEach(() => {
  cleanup();
});

describe('BottomDock', () => {
  it('highlights the active tab with aria-current="page"', () => {
    render(
      <MemoryRouter initialEntries={['/map']}>
        <BottomDock />
      </MemoryRouter>
    );

    const mapLink = screen.getByRole('link', { name: /map/i });
    const todayLink = screen.getByRole('link', { name: /today/i });
    const talkLink = screen.getByRole('link', { name: /talk/i });

    expect(mapLink).toHaveAttribute('aria-current', 'page');
    expect(todayLink).not.toHaveAttribute('aria-current');
    expect(talkLink).not.toHaveAttribute('aria-current');
  });

  it('renders all three navigation links', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomDock />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /today/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /map/i })).toHaveAttribute('href', '/map');
    expect(screen.getByRole('link', { name: /talk/i })).toHaveAttribute('href', '/talk');
  });
});
