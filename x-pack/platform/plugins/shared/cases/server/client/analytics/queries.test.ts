/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  buildOwnerFilter,
  closedInWindowQuery,
  closedVolumeQuery,
  mttrQuery,
  openCasesQuery,
  openedInWindowQuery,
  openedVolumeQuery,
  severityDistributionQuery,
  statusDistributionQuery,
  topAssigneesQuery,
  unassignedQuery,
} from './queries';

describe('analytics query builders', () => {
  describe('buildOwnerFilter', () => {
    it('returns an empty stage and no params when authorizedOwners is undefined', () => {
      expect(buildOwnerFilter(undefined)).toEqual({ stage: '', params: [] });
    });

    it('returns an empty stage and no params when authorizedOwners is an empty array', () => {
      expect(buildOwnerFilter([])).toEqual({ stage: '', params: [] });
    });

    it('emits one positional placeholder per owner and passes owners as params', () => {
      expect(buildOwnerFilter(['securitySolution', 'observability'])).toEqual({
        stage: '| WHERE cases.owner IN (?, ?) ',
        params: ['securitySolution', 'observability'],
      });
    });

    it('never interpolates owner names into the pipeline string', () => {
      const result = buildOwnerFilter(['maliciousOwner; DROP cases']);
      expect(result.stage).toBe('| WHERE cases.owner IN (?) ');
      expect(result.stage).not.toContain('maliciousOwner');
      expect(result.params).toEqual(['maliciousOwner; DROP cases']);
    });
  });

  describe('preset queries with an owner filter', () => {
    const owner = buildOwnerFilter(['securitySolution']);
    const from = '2026-03-01T00:00:00.000Z';
    const to = '2026-03-31T23:59:59.999Z';

    it('openCasesQuery: filters out closed (numeric 20) and aggregates count', () => {
      const q = openCasesQuery(owner);
      expect(q.pipeline).toContain('WHERE cases.owner IN (?)');
      expect(q.pipeline).toContain('WHERE cases.status != 20');
      expect(q.pipeline).toContain('STATS count = COUNT(*)');
      expect(q.params).toEqual(['securitySolution']);
    });

    it('unassignedQuery: tests empty assignee via MV_COUNT', () => {
      const q = unassignedQuery(owner);
      expect(q.pipeline).toContain('MV_COUNT(cases.assignees.uid)');
      expect(q.pipeline).toContain('assignee_count IS NULL OR assignee_count == 0');
    });

    it('openedInWindowQuery: bounds on created_at with positional params', () => {
      const q = openedInWindowQuery(owner, from, to);
      expect(q.pipeline).toContain('cases.created_at >= ? AND cases.created_at <= ?');
      expect(q.params).toEqual(['securitySolution', from, to]);
    });

    it('closedInWindowQuery: bounds on closed_at with positional params', () => {
      const q = closedInWindowQuery(owner, from, to);
      expect(q.pipeline).toContain('cases.closed_at >= ? AND cases.closed_at <= ?');
      expect(q.params).toEqual(['securitySolution', from, to]);
    });

    it('mttrQuery: filters to closed (numeric 20) and averages the pre-computed cases.duration', () => {
      const q = mttrQuery(owner, from, to);
      expect(q.pipeline).toContain('WHERE cases.status == 20');
      expect(q.pipeline).toContain('cases.closed_at >= ? AND cases.closed_at <= ?');
      expect(q.pipeline).toContain('STATS mttr_ms = AVG(cases.duration)');
      expect(q.params).toEqual(['securitySolution', from, to]);
    });

    it('openedVolumeQuery: buckets by day and caps at 365 rows', () => {
      const q = openedVolumeQuery(owner, from, to);
      expect(q.pipeline).toContain('DATE_TRUNC(1 day, cases.created_at)');
      expect(q.pipeline).toContain('STATS opened = COUNT(*) BY bucket');
      expect(q.pipeline).toContain('SORT bucket ASC');
      expect(q.pipeline).toContain('LIMIT 365');
    });

    it('closedVolumeQuery: buckets on closed_at', () => {
      const q = closedVolumeQuery(owner, from, to);
      expect(q.pipeline).toContain('DATE_TRUNC(1 day, cases.closed_at)');
      expect(q.pipeline).toContain('STATS closed = COUNT(*) BY bucket');
    });

    it('topAssigneesQuery: expands multi-value assignees and sorts descending with LIMIT 10', () => {
      const q = topAssigneesQuery(owner);
      expect(q.pipeline).toContain('MV_EXPAND cases.assignees.uid');
      expect(q.pipeline).toContain('SORT count DESC');
      expect(q.pipeline).toContain('LIMIT 10');
    });

    it('statusDistributionQuery and severityDistributionQuery: emit BY clauses on the right field', () => {
      expect(statusDistributionQuery(owner).pipeline).toContain(
        'STATS count = COUNT(*) BY status = cases.status'
      );
      expect(severityDistributionQuery(owner).pipeline).toContain(
        'STATS count = COUNT(*) BY severity = cases.severity'
      );
    });
  });

  describe('preset queries without an owner filter (security disabled)', () => {
    const owner = buildOwnerFilter(undefined);

    it('does NOT emit any WHERE cases.owner clause', () => {
      const q = openCasesQuery(owner);
      expect(q.pipeline).not.toContain('cases.owner');
      expect(q.params).toEqual([]);
    });

    it('still emits the rest of the pipeline correctly', () => {
      const q = statusDistributionQuery(owner);
      expect(q.pipeline).toBe('| STATS count = COUNT(*) BY status = cases.status');
      expect(q.params).toEqual([]);
    });
  });
});
