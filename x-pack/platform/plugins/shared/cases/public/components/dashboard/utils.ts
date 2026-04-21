/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Humanize a millisecond duration into the most useful two-unit representation.
 * Examples: 0ms → "<1m", 45_000ms → "45s", 3_600_000ms → "1h", 90_000_000ms → "1d 1h".
 */
export const humanizeDuration = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < MS_PER_MINUTE) {
    const s = Math.round(ms / MS_PER_SECOND);
    return s === 0 ? '<1m' : `${s}s`;
  }
  if (ms < MS_PER_HOUR) {
    return `${Math.round(ms / MS_PER_MINUTE)}m`;
  }
  if (ms < MS_PER_DAY) {
    const hours = Math.floor(ms / MS_PER_HOUR);
    const minutes = Math.round((ms % MS_PER_HOUR) / MS_PER_MINUTE);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(ms / MS_PER_DAY);
  const hours = Math.round((ms % MS_PER_DAY) / MS_PER_HOUR);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
};
