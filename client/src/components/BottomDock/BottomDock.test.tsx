import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { BottomDock } from './BottomDock';

afterEach(() => {
  cleanup();
});

describe('BottomDock', () => {
  it('highlights the active tab with aria-current="page"', () => {
    render(
      <BrowserRouter>
        <BottomDock activeTab="map" />
      </BrowserRouter>
    );

    const mapBtn = screen.getByRole('button', { name: /map/i });
    const todayBtn = screen.getByRole('button', { name: /today/i });
    const talkBtn = screen.getByRole('button', { name: /talk/i });

    expect(mapBtn).toHaveAttribute('aria-current', 'page');
    expect(todayBtn).not.toHaveAttribute('aria-current');
    expect(talkBtn).toBeDisabled();
  });

  it('navigates when clicking an inactive tab', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <BottomDock activeTab="today" />
      </BrowserRouter>
    );

    const mapBtn = screen.getByRole('button', { name: /map/i });
    await user.click(mapBtn);
    expect(window.location.pathname).toBe('/map');
  });
});
