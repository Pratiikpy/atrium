import { describe, it, expect } from 'vitest';
import { VENUES, SUBSYSTEMS, TECHNOLOGY_STACK } from './static';

describe('Static catalog arrays (snapshot)', () => {
  it('VENUES matches snapshot', () => {
    expect(VENUES).toMatchSnapshot();
  });

  it('SUBSYSTEMS matches snapshot', () => {
    expect(SUBSYSTEMS).toMatchSnapshot();
  });

  it('TECHNOLOGY_STACK matches snapshot', () => {
    expect(TECHNOLOGY_STACK).toMatchSnapshot();
  });

  // Guard against accidental mutations
  it('VENUES has expected length', () => {
    expect(VENUES.length).toBe(8);
  });

  it('SUBSYSTEMS has expected length', () => {
    expect(SUBSYSTEMS.length).toBe(18);
  });

  it('TECHNOLOGY_STACK has expected length', () => {
    expect(TECHNOLOGY_STACK.length).toBe(8);
  });
});
