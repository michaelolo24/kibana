/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Boom from '@hapi/boom';
import type { estypes } from '@elastic/elasticsearch';
import type { Logger } from '@kbn/core/server';
import type {
  AnalyticsDashboardRequest,
  AnalyticsDashboardResponse,
} from '../../../common/types/api';
import {
  AnalyticsDashboardRequestRt,
  AnalyticsDashboardResponseRt,
} from '../../../common/types/api/analytics/v1';
import { Operations } from '../../authorization';
import { decodeOrThrow, decodeWithExcessOrThrow } from '../../common/runtime_types';
import { createCaseError } from '../../common/error';
import type { CasesClientArgs } from '../types';
import {
  buildOwnerFilter,
  closedInWindowQuery,
  closedVolumeQuery,
  mttrQuery,
  openCasesQuery,
  openedInWindowQuery,
  openedVolumeQuery,
  PERSISTED_SEVERITY,
  PERSISTED_STATUS,
  runEsql,
  severityDistributionQuery,
  statusDistributionQuery,
  topAssigneesQuery,
  unassignedQuery,
  type OwnerFilter,
  type PresetQuery,
} from './queries';

type EsqlColumn = { name: string; type: string };
type EsqlRow = Array<estypes.FieldValue | null>;
type EsqlResponse = { columns: EsqlColumn[]; values: EsqlRow[] };

/**
 * Stable error code surfaced in `error` fields of the response. The UI is responsible for
 * mapping this code to a localized string — we don't ship user copy from the server.
 */
export const ANALYTICS_QUERY_FAILED = 'ANALYTICS_QUERY_FAILED';

const colIndex = (response: EsqlResponse, name: string): number =>
  response.columns.findIndex((c) => c.name === name);

const toNumber = (value: estypes.FieldValue | null | undefined): number | null =>
  typeof value === 'number' ? value : null;

const readScalar = (response: EsqlResponse, column: string): number | null => {
  const idx = colIndex(response, column);
  if (idx === -1 || response.values.length === 0) return null;
  return toNumber(response.values[0][idx]);
};

const emptyResponse = (): AnalyticsDashboardResponse => ({
  openCases: { value: 0, error: null },
  unassigned: { value: 0, error: null },
  closureRate: { value: null, error: null },
  mttrMs: { value: null, error: null },
  volume: { data: [], error: null },
  topAssignees: { data: [], error: null },
  statusDistribution: { data: { open: 0, inProgress: 0, closed: 0 }, error: null },
  severityDistribution: { data: { critical: 0, high: 0, medium: 0, low: 0 }, error: null },
});

interface CardResult<T> {
  value: T | null;
  error: string | null;
}

const safe = async <T>(
  fn: () => Promise<T>,
  logger: Logger,
  label: string
): Promise<CardResult<T>> => {
  try {
    return { value: await fn(), error: null };
  } catch (error) {
    // ES|QL errors come back as Elasticsearch transport errors — the human-readable reason
    // lives in `meta.body.error.reason`; fall back to `error.message` for other shapes.
    const esReason =
      error?.meta?.body?.error?.reason ??
      error?.meta?.body?.error?.root_cause?.[0]?.reason ??
      null;
    logger.warn(
      `[cases:analytics:dashboard] "${label}" query failed: ${
        esReason ?? error?.message ?? String(error)
      }`
    );
    return { value: null, error: ANALYTICS_QUERY_FAILED };
  }
};

export const getAnalyticsDashboard = async (
  params: AnalyticsDashboardRequest,
  clientArgs: CasesClientArgs
): Promise<AnalyticsDashboardResponse> => {
  const { authorization, unsecuredSavedObjectsClient, spaceId, logger } = clientArgs;
  const log = logger.get('analytics', 'dashboard');

  try {
    const { from, to } = decodeWithExcessOrThrow(AnalyticsDashboardRequestRt)(params);

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw Boom.badRequest('"from" and "to" must be ISO 8601 dates');
    }
    if (fromDate.getTime() > toDate.getTime()) {
      throw Boom.badRequest('"from" must be before "to"');
    }
    const fromIso = fromDate.toISOString();
    const toIso = toDate.toISOString();

    const { authorizedOwners } = await authorization.getAuthorizationFilter(
      Operations.getCasesMetrics
    );

    log.info(
      `[cases:analytics:dashboard] invoked — spaceId=${spaceId} from=${fromIso} to=${toIso} authorizedOwners=${
        authorizedOwners === undefined ? 'all (security off)' : `[${authorizedOwners.join(', ')}]`
      }`
    );

    // Security enabled and user has no Cases read access anywhere → nothing to show.
    // Security disabled → `authorizedOwners` is undefined; we leave the owner filter off
    // and let ESQL return all owners' data. See QA audit B1 — we do NOT substitute OWNERS.
    if (authorizedOwners && authorizedOwners.length === 0) {
      return decodeOrThrow(AnalyticsDashboardResponseRt)(emptyResponse());
    }

    const owner = buildOwnerFilter(authorizedOwners);

    const runQuery = async (query: PresetQuery) => {
      try {
        return (await runEsql({
          soClient: unsecuredSavedObjectsClient,
          spaceId,
          query,
        })) as unknown as EsqlResponse;
      } catch (err) {
        // Re-throw with pipeline context attached; `safe()` will log the wrapped error.
        const original =
          err?.meta?.body?.error?.reason ??
          err?.meta?.body?.error?.root_cause?.[0]?.reason ??
          err?.message ??
          String(err);
        throw new Error(`${original} — pipeline: [${query.pipeline}]`);
      }
    };

    const [
      openCasesCard,
      unassignedCard,
      openedInWindowCard,
      closedInWindowCard,
      mttrCard,
      openedVolumeCard,
      closedVolumeCard,
      topAssigneesCard,
      statusCard,
      severityCard,
    ] = await Promise.all([
      safe(() => readOpenCases(runQuery, owner), log, 'openCases'),
      safe(() => readUnassigned(runQuery, owner), log, 'unassigned'),
      safe(() => readCount(runQuery, openedInWindowQuery(owner, fromIso, toIso)), log, 'closureRate.opened'),
      safe(() => readCount(runQuery, closedInWindowQuery(owner, fromIso, toIso)), log, 'closureRate.closed'),
      safe(() => readMttr(runQuery, owner, fromIso, toIso), log, 'mttrMs'),
      safe(() => runQuery(openedVolumeQuery(owner, fromIso, toIso)), log, 'volume.opened'),
      safe(() => runQuery(closedVolumeQuery(owner, fromIso, toIso)), log, 'volume.closed'),
      safe(() => readTopAssignees(runQuery, owner), log, 'topAssignees'),
      safe(() => readStatusDistribution(runQuery, owner), log, 'statusDistribution'),
      safe(() => readSeverityDistribution(runQuery, owner), log, 'severityDistribution'),
    ]);

    const result: AnalyticsDashboardResponse = {
      openCases: openCasesCard,
      unassigned: unassignedCard,
      closureRate: computeClosureRate(openedInWindowCard, closedInWindowCard),
      mttrMs: mttrCard,
      volume: mergeVolume(openedVolumeCard, closedVolumeCard),
      topAssignees: { data: topAssigneesCard.value, error: topAssigneesCard.error },
      statusDistribution: { data: statusCard.value, error: statusCard.error },
      severityDistribution: { data: severityCard.value, error: severityCard.error },
    };

    return decodeOrThrow(AnalyticsDashboardResponseRt)(result);
  } catch (error) {
    throw createCaseError({
      logger: log,
      message: `Failed to retrieve cases analytics dashboard: ${error}`,
      error,
    });
  }
};

const readOpenCases = async (
  runQuery: (q: PresetQuery) => Promise<EsqlResponse>,
  owner: OwnerFilter
) => readScalar(await runQuery(openCasesQuery(owner)), 'count');

const readUnassigned = async (
  runQuery: (q: PresetQuery) => Promise<EsqlResponse>,
  owner: OwnerFilter
) => readScalar(await runQuery(unassignedQuery(owner)), 'count');

const readCount = async (
  runQuery: (q: PresetQuery) => Promise<EsqlResponse>,
  query: PresetQuery
) => readScalar(await runQuery(query), 'count');

// Spec: closed / (opened + closed). Returns percentage rounded to nearest integer.
// If either sub-count errored, surface the error. If the sum is zero, no data — null.
const computeClosureRate = (
  openedCard: CardResult<number | null>,
  closedCard: CardResult<number | null>
): CardResult<number | null> => {
  if (openedCard.error || closedCard.error) {
    return { value: null, error: openedCard.error ?? closedCard.error };
  }
  const opened = openedCard.value ?? 0;
  const closed = closedCard.value ?? 0;
  const total = opened + closed;
  if (total === 0) {
    return { value: null, error: null };
  }
  return { value: Math.round((closed / total) * 100), error: null };
};

const readMttr = async (
  runQuery: (q: PresetQuery) => Promise<EsqlResponse>,
  owner: OwnerFilter,
  from: string,
  to: string
) => readScalar(await runQuery(mttrQuery(owner, from, to)), 'mttr_ms');

const readTopAssignees = async (
  runQuery: (q: PresetQuery) => Promise<EsqlResponse>,
  owner: OwnerFilter
) => {
  const response = await runQuery(topAssigneesQuery(owner));
  const assigneeIdx = colIndex(response, 'assignee');
  const countIdx = colIndex(response, 'count');
  if (assigneeIdx === -1 || countIdx === -1) return [];

  return response.values
    .map((row) => ({
      assignee: String(row[assigneeIdx] ?? ''),
      count: toNumber(row[countIdx]) ?? 0,
    }))
    .filter((entry) => entry.assignee.length > 0 && entry.count > 0);
};

const readStatusDistribution = async (
  runQuery: (q: PresetQuery) => Promise<EsqlResponse>,
  owner: OwnerFilter
) => {
  const response = await runQuery(statusDistributionQuery(owner));
  const statusIdx = colIndex(response, 'status');
  const countIdx = colIndex(response, 'count');
  const dist = { open: 0, inProgress: 0, closed: 0 };
  if (statusIdx === -1 || countIdx === -1) return dist;

  for (const row of response.values) {
    const status = toNumber(row[statusIdx]);
    const count = toNumber(row[countIdx]) ?? 0;
    if (status === PERSISTED_STATUS.OPEN) dist.open = count;
    else if (status === PERSISTED_STATUS.IN_PROGRESS) dist.inProgress = count;
    else if (status === PERSISTED_STATUS.CLOSED) dist.closed = count;
  }
  return dist;
};

const readSeverityDistribution = async (
  runQuery: (q: PresetQuery) => Promise<EsqlResponse>,
  owner: OwnerFilter
) => {
  const response = await runQuery(severityDistributionQuery(owner));
  const severityIdx = colIndex(response, 'severity');
  const countIdx = colIndex(response, 'count');
  const dist = { critical: 0, high: 0, medium: 0, low: 0 };
  if (severityIdx === -1 || countIdx === -1) return dist;

  for (const row of response.values) {
    const severity = toNumber(row[severityIdx]);
    const count = toNumber(row[countIdx]) ?? 0;
    if (severity === PERSISTED_SEVERITY.CRITICAL) dist.critical = count;
    else if (severity === PERSISTED_SEVERITY.HIGH) dist.high = count;
    else if (severity === PERSISTED_SEVERITY.MEDIUM) dist.medium = count;
    else if (severity === PERSISTED_SEVERITY.LOW) dist.low = count;
  }
  return dist;
};

// Surface partial-failure errors: if one sub-query fails, caller still renders the other
// side of the chart but the UI can flag missing data via `error`.
const mergeVolume = (
  openedCard: CardResult<EsqlResponse>,
  closedCard: CardResult<EsqlResponse>
) => {
  if (openedCard.error && closedCard.error) {
    return { data: null, error: openedCard.error };
  }

  const byDate = new Map<string, { date: string; opened: number; closed: number }>();

  const merge = (card: CardResult<EsqlResponse>, field: 'opened' | 'closed') => {
    if (!card.value) return;
    const bucketIdx = colIndex(card.value, 'bucket');
    const countIdx = colIndex(card.value, field);
    if (bucketIdx === -1 || countIdx === -1) return;
    for (const row of card.value.values) {
      const date = String(row[bucketIdx] ?? '');
      if (!date) continue;
      const count = toNumber(row[countIdx]) ?? 0;
      const existing = byDate.get(date);
      if (existing) {
        existing[field] = count;
      } else {
        byDate.set(date, {
          date,
          opened: field === 'opened' ? count : 0,
          closed: field === 'closed' ? count : 0,
        });
      }
    }
  };

  merge(openedCard, 'opened');
  merge(closedCard, 'closed');

  const data = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { data, error: openedCard.error ?? closedCard.error };
};

