/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { loggingSystemMock, savedObjectsClientMock } from '@kbn/core/server/mocks';
import { createAuthorizationMock } from '../../authorization/mock';
import type { CasesClientArgs } from '../types';
import { getAnalyticsDashboard } from './get_dashboard';

type EsqlResponseShape = { columns: Array<{ name: string; type: string }>; values: unknown[][] };

const buildClientArgs = () => {
  const authorization = createAuthorizationMock();
  const logger = loggingSystemMock.createLogger();
  const unsecuredSavedObjectsClient = savedObjectsClientMock.create();

  // Override .esql to be a jest mock we can script per test.
  (unsecuredSavedObjectsClient as unknown as { esql: jest.Mock }).esql = jest.fn();

  const clientArgs = {
    authorization,
    unsecuredSavedObjectsClient,
    spaceId: 'default',
    logger,
  } as unknown as CasesClientArgs;

  return { clientArgs, authorization, logger, esql: unsecuredSavedObjectsClient.esql as jest.Mock };
};

const scalarCountResponse = (count: number): EsqlResponseShape => ({
  columns: [{ name: 'count', type: 'long' }],
  values: [[count]],
});

const closureResponse = (count: number): EsqlResponseShape => scalarCountResponse(count);

const mttrResponse = (ms: number | null): EsqlResponseShape => ({
  columns: [{ name: 'mttr_ms', type: 'double' }],
  values: ms === null ? [[null]] : [[ms]],
});

const volumeResponse = (
  field: 'opened' | 'closed',
  rows: Array<{ bucket: string; count: number }>
): EsqlResponseShape => ({
  columns: [
    { name: 'opened', type: 'long' },
    { name: 'closed', type: 'long' },
    { name: 'bucket', type: 'date' },
  ].filter((c) => c.name === field || c.name === 'bucket'),
  values: rows.map((r) => (field === 'opened' ? [r.count, r.bucket] : [r.count, r.bucket])),
});

const assigneesResponse = (rows: Array<{ assignee: string; count: number }>): EsqlResponseShape => ({
  columns: [
    { name: 'count', type: 'long' },
    { name: 'assignee', type: 'keyword' },
  ],
  values: rows.map((r) => [r.count, r.assignee]),
});

const statusResponse = (rows: Array<{ status: string; count: number }>): EsqlResponseShape => ({
  columns: [
    { name: 'count', type: 'long' },
    { name: 'status', type: 'keyword' },
  ],
  values: rows.map((r) => [r.count, r.status]),
});

const severityResponse = (
  rows: Array<{ severity: string; count: number }>
): EsqlResponseShape => ({
  columns: [
    { name: 'count', type: 'long' },
    { name: 'severity', type: 'keyword' },
  ],
  values: rows.map((r) => [r.count, r.severity]),
});

describe('getAnalyticsDashboard', () => {
  const params = { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' };

  /**
   * FAILURE SCENARIO: user has no Cases read access in this space
   * Symptom: dashboard renders with zeroed hero cards but never calls ES
   * Log signature: `[cases:analytics:dashboard] invoked`
   * Trigger: authorization.getAuthorizationFilter returns authorizedOwners: []
   * Recovery: user-initiated — assign Cases read role and retry
   */
  it('short-circuits to empty response when authorizedOwners is an empty array', async () => {
    const { clientArgs, authorization, esql } = buildClientArgs();
    authorization.getAuthorizationFilter.mockResolvedValue({
      filter: undefined,
      ensureSavedObjectsAreAuthorized: () => {},
      authorizedOwners: [],
    });

    const result = await getAnalyticsDashboard(params, clientArgs);

    expect(esql).not.toHaveBeenCalled();
    expect(result.openCases).toEqual({ value: 0, error: null });
    expect(result.closureRate).toEqual({ value: null, error: null });
    expect(result.mttrMs).toEqual({ value: null, error: null });
    expect(result.volume).toEqual({ data: [], error: null });
  });

  it('passes authorized owners as positional ES|QL params when security is enabled', async () => {
    const { clientArgs, authorization, esql } = buildClientArgs();
    authorization.getAuthorizationFilter.mockResolvedValue({
      filter: undefined,
      ensureSavedObjectsAreAuthorized: () => {},
      authorizedOwners: ['securitySolution', 'observability'],
    });
    esql.mockResolvedValue(scalarCountResponse(0));

    await getAnalyticsDashboard(params, clientArgs);

    const firstCall = esql.mock.calls[0][0];
    expect(firstCall.type).toBe('cases');
    expect(firstCall.namespaces).toEqual(['default']);
    expect(firstCall.pipeline).toContain('cases.owner IN (?, ?)');
    expect(firstCall.params.slice(0, 2)).toEqual(['securitySolution', 'observability']);
    // No owner literal anywhere in the pipeline text
    expect(firstCall.pipeline).not.toContain('securitySolution');
    expect(firstCall.pipeline).not.toContain('observability');
  });

  it('emits no owner clause when security is disabled (authorizedOwners undefined)', async () => {
    const { clientArgs, authorization, esql } = buildClientArgs();
    authorization.getAuthorizationFilter.mockResolvedValue({
      filter: undefined,
      ensureSavedObjectsAreAuthorized: () => {},
      authorizedOwners: undefined,
    });
    esql.mockResolvedValue(scalarCountResponse(0));

    await getAnalyticsDashboard(params, clientArgs);

    const firstCall = esql.mock.calls[0][0];
    expect(firstCall.pipeline).not.toContain('cases.owner');
    expect(firstCall.params).toEqual([]);
  });

  it('computes closure rate as closed / (opened + closed) * 100', async () => {
    const { clientArgs, authorization, esql } = buildClientArgs();
    authorization.getAuthorizationFilter.mockResolvedValue({
      filter: undefined,
      ensureSavedObjectsAreAuthorized: () => {},
      authorizedOwners: ['securitySolution'],
    });

    // Order of Promise.all: openCases, unassigned, openedInWindow, closedInWindow, mttr,
    // openedVolume, closedVolume, topAssignees, status, severity.
    esql
      .mockResolvedValueOnce(scalarCountResponse(10)) // openCases
      .mockResolvedValueOnce(scalarCountResponse(3)) // unassigned
      .mockResolvedValueOnce(closureResponse(7)) // openedInWindow
      .mockResolvedValueOnce(closureResponse(3)) // closedInWindow
      .mockResolvedValueOnce(mttrResponse(3_600_000)) // mttr
      .mockResolvedValueOnce(volumeResponse('opened', [])) // openedVolume
      .mockResolvedValueOnce(volumeResponse('closed', [])) // closedVolume
      .mockResolvedValueOnce(assigneesResponse([])) // topAssignees
      .mockResolvedValueOnce(statusResponse([])) // status
      .mockResolvedValueOnce(severityResponse([])); // severity

    const result = await getAnalyticsDashboard(params, clientArgs);

    // 3 / (7 + 3) * 100 = 30
    expect(result.closureRate).toEqual({ value: 30, error: null });
    expect(result.mttrMs).toEqual({ value: 3_600_000, error: null });
    expect(result.openCases).toEqual({ value: 10, error: null });
    expect(result.unassigned).toEqual({ value: 3, error: null });
  });

  it('returns null closureRate when opened + closed is zero', async () => {
    const { clientArgs, authorization, esql } = buildClientArgs();
    authorization.getAuthorizationFilter.mockResolvedValue({
      filter: undefined,
      ensureSavedObjectsAreAuthorized: () => {},
      authorizedOwners: ['securitySolution'],
    });
    esql.mockResolvedValue(scalarCountResponse(0));

    const result = await getAnalyticsDashboard(params, clientArgs);

    expect(result.closureRate).toEqual({ value: null, error: null });
  });

  /**
   * FAILURE SCENARIO: single card query fails
   * Symptom: one hero card shows "Couldn't load this metric" while others keep working
   * Log signature: `[cases:analytics:dashboard] "mttrMs" query failed`
   * Trigger: ES returns a 5xx or throws for one of the nine queries
   * Recovery: user clicks retry; card-level refresh reruns all queries
   */
  it('isolates a single query failure: that card has an error code, others succeed', async () => {
    const { clientArgs, authorization, logger, esql } = buildClientArgs();
    authorization.getAuthorizationFilter.mockResolvedValue({
      filter: undefined,
      ensureSavedObjectsAreAuthorized: () => {},
      authorizedOwners: ['securitySolution'],
    });

    esql
      .mockResolvedValueOnce(scalarCountResponse(10)) // openCases OK
      .mockResolvedValueOnce(scalarCountResponse(3)) // unassigned OK
      .mockResolvedValueOnce(closureResponse(7)) // openedInWindow OK
      .mockResolvedValueOnce(closureResponse(3)) // closedInWindow OK
      .mockRejectedValueOnce(new Error('ES down')) // mttr FAILS
      .mockResolvedValueOnce(volumeResponse('opened', []))
      .mockResolvedValueOnce(volumeResponse('closed', []))
      .mockResolvedValueOnce(assigneesResponse([]))
      .mockResolvedValueOnce(statusResponse([]))
      .mockResolvedValueOnce(severityResponse([]));

    const result = await getAnalyticsDashboard(params, clientArgs);

    expect(result.openCases).toEqual({ value: 10, error: null });
    expect(result.mttrMs).toEqual({ value: null, error: 'ANALYTICS_QUERY_FAILED' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"mttrMs" query failed')
    );
  });

  it('rejects with a 400 when from is malformed', async () => {
    const { clientArgs } = buildClientArgs();

    await expect(
      getAnalyticsDashboard({ from: 'not-a-date', to: '2026-03-31T00:00:00.000Z' }, clientArgs)
    ).rejects.toThrow(/ISO 8601/);
  });

  it('rejects when from is after to', async () => {
    const { clientArgs } = buildClientArgs();

    await expect(
      getAnalyticsDashboard(
        { from: '2026-04-01T00:00:00.000Z', to: '2026-03-01T00:00:00.000Z' },
        clientArgs
      )
    ).rejects.toThrow(/"from" must be before "to"/);
  });

  it('aggregates status distribution into the expected shape', async () => {
    const { clientArgs, authorization, esql } = buildClientArgs();
    authorization.getAuthorizationFilter.mockResolvedValue({
      filter: undefined,
      ensureSavedObjectsAreAuthorized: () => {},
      authorizedOwners: ['securitySolution'],
    });

    esql
      .mockResolvedValueOnce(scalarCountResponse(0))
      .mockResolvedValueOnce(scalarCountResponse(0))
      .mockResolvedValueOnce(closureResponse(0))
      .mockResolvedValueOnce(closureResponse(0))
      .mockResolvedValueOnce(mttrResponse(null))
      .mockResolvedValueOnce(volumeResponse('opened', []))
      .mockResolvedValueOnce(volumeResponse('closed', []))
      .mockResolvedValueOnce(assigneesResponse([]))
      .mockResolvedValueOnce(
        statusResponse([
          { status: 'open', count: 5 },
          { status: 'in-progress', count: 2 },
          { status: 'closed', count: 11 },
        ])
      )
      .mockResolvedValueOnce(severityResponse([]));

    const result = await getAnalyticsDashboard(params, clientArgs);

    expect(result.statusDistribution).toEqual({
      data: { open: 5, inProgress: 2, closed: 11 },
      error: null,
    });
  });

  it('merges opened and closed volume buckets into one sorted series', async () => {
    const { clientArgs, authorization, esql } = buildClientArgs();
    authorization.getAuthorizationFilter.mockResolvedValue({
      filter: undefined,
      ensureSavedObjectsAreAuthorized: () => {},
      authorizedOwners: ['securitySolution'],
    });

    esql
      .mockResolvedValueOnce(scalarCountResponse(0))
      .mockResolvedValueOnce(scalarCountResponse(0))
      .mockResolvedValueOnce(closureResponse(0))
      .mockResolvedValueOnce(closureResponse(0))
      .mockResolvedValueOnce(mttrResponse(null))
      .mockResolvedValueOnce(
        volumeResponse('opened', [
          { bucket: '2026-03-01T00:00:00.000Z', count: 3 },
          { bucket: '2026-03-02T00:00:00.000Z', count: 5 },
        ])
      )
      .mockResolvedValueOnce(
        volumeResponse('closed', [
          { bucket: '2026-03-02T00:00:00.000Z', count: 4 },
          { bucket: '2026-03-03T00:00:00.000Z', count: 1 },
        ])
      )
      .mockResolvedValueOnce(assigneesResponse([]))
      .mockResolvedValueOnce(statusResponse([]))
      .mockResolvedValueOnce(severityResponse([]));

    const result = await getAnalyticsDashboard(params, clientArgs);

    expect(result.volume.data).toEqual([
      { date: '2026-03-01T00:00:00.000Z', opened: 3, closed: 0 },
      { date: '2026-03-02T00:00:00.000Z', opened: 5, closed: 4 },
      { date: '2026-03-03T00:00:00.000Z', opened: 0, closed: 1 },
    ]);
    expect(result.volume.error).toBeNull();
  });
});
