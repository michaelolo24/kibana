/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { humanizeDuration } from './utils';

describe('humanizeDuration', () => {
  it('returns "—" for NaN', () => {
    expect(humanizeDuration(NaN)).toBe('—');
  });

  it('returns "—" for negative values', () => {
    expect(humanizeDuration(-1)).toBe('—');
  });

  it('returns "<1m" for values under one minute when rounding to seconds yields zero', () => {
    expect(humanizeDuration(0)).toBe('<1m');
    expect(humanizeDuration(400)).toBe('<1m');
  });

  it('returns seconds for values under one minute', () => {
    expect(humanizeDuration(45_000)).toBe('45s');
  });

  it('returns minutes for values under one hour', () => {
    expect(humanizeDuration(5 * 60_000)).toBe('5m');
    expect(humanizeDuration(59 * 60_000)).toBe('59m');
  });

  it('returns hours (and optional minutes) under one day', () => {
    expect(humanizeDuration(3_600_000)).toBe('1h');
    expect(humanizeDuration(3_600_000 + 5 * 60_000)).toBe('1h 5m');
  });

  it('returns days (and optional hours) for ms >= 1 day', () => {
    expect(humanizeDuration(86_400_000)).toBe('1d');
    expect(humanizeDuration(86_400_000 + 3_600_000)).toBe('1d 1h');
  });
});
