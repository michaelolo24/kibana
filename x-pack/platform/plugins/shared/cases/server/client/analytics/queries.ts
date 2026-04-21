/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { estypes } from '@elastic/elasticsearch';
import type { SavedObjectsClientContract } from '@kbn/core/server';

export const CASE_SAVED_OBJECT_TYPE = 'cases';

/**
 * `cases.status` and `cases.severity` are persisted as numeric `short` in the Cases SO mapping
 * (see `server/common/types/case.ts::CasePersistedStatus`). Compare against these constants —
 * string literals like "closed" are the public/domain form and do NOT match the stored value.
 */
export const PERSISTED_STATUS = {
  OPEN: 0,
  IN_PROGRESS: 10,
  CLOSED: 20,
} as const;

export const PERSISTED_SEVERITY = {
  LOW: 0,
  MEDIUM: 10,
  HIGH: 20,
  CRITICAL: 30,
} as const;

export interface OwnerFilter {
  /**
   * Optional pipe stage: `| WHERE cases.owner IN (?, ?, ...) `.
   * Empty string means "no owner filter" — used when security is disabled so that
   * newly registered owners are implicitly visible instead of being silently excluded.
   */
  stage: string;
  /** Positional params for the owner list. Come first in the params array when non-empty. */
  params: estypes.EsqlESQLParam[];
}

export const buildOwnerFilter = (authorizedOwners: string[] | undefined): OwnerFilter => {
  if (!authorizedOwners || authorizedOwners.length === 0) {
    return { stage: '', params: [] };
  }

  const placeholders = authorizedOwners.map(() => '?').join(', ');
  return {
    stage: `| WHERE cases.owner IN (${placeholders}) `,
    params: authorizedOwners,
  };
};

export interface PresetQuery {
  pipeline: string;
  params: estypes.EsqlESQLParam[];
}

// Each stage is authored with its own leading `|` — just concatenate them with spaces.
// Using `' | '` as a join separator would produce `| ... | | ...` (double pipes) since
// each stage already starts with `|`. ES|QL's parser rejects that with a parsing_exception.
const pipeline = (ownerStage: string, ...stages: string[]): string =>
  `${ownerStage}${stages.map((s) => s.trim()).filter(Boolean).join(' ')}`.trim();

export const openCasesQuery = (owner: OwnerFilter): PresetQuery => ({
  pipeline: pipeline(
    owner.stage,
    `| WHERE cases.status != ${PERSISTED_STATUS.CLOSED}`,
    '| STATS count = COUNT(*)'
  ),
  params: [...owner.params],
});

export const unassignedQuery = (owner: OwnerFilter): PresetQuery => ({
  pipeline: pipeline(
    owner.stage,
    `| WHERE cases.status != ${PERSISTED_STATUS.CLOSED}`,
    '| EVAL assignee_count = MV_COUNT(cases.assignees.uid)',
    '| WHERE assignee_count IS NULL OR assignee_count == 0',
    '| STATS count = COUNT(*)'
  ),
  params: [...owner.params],
});

// Spec: "closed in window / (opened in window + closed in window) * 100". Two counts, computed in parallel.
export const openedInWindowQuery = (
  owner: OwnerFilter,
  from: string,
  to: string
): PresetQuery => ({
  pipeline: pipeline(
    owner.stage,
    '| WHERE cases.created_at >= ? AND cases.created_at <= ?',
    '| STATS count = COUNT(*)'
  ),
  params: [...owner.params, from, to],
});

export const closedInWindowQuery = (
  owner: OwnerFilter,
  from: string,
  to: string
): PresetQuery => ({
  pipeline: pipeline(
    owner.stage,
    '| WHERE cases.closed_at >= ? AND cases.closed_at <= ?',
    '| STATS count = COUNT(*)'
  ),
  params: [...owner.params, from, to],
});

// Use the pre-computed `cases.duration` (unsigned_long, milliseconds) rather than DATE_DIFF —
// matches the existing Cases `getCasesMetrics` MTTR aggregation at
// `server/client/metrics/all_cases/aggregations/avg_duration.ts`.
export const mttrQuery = (owner: OwnerFilter, from: string, to: string): PresetQuery => ({
  pipeline: pipeline(
    owner.stage,
    `| WHERE cases.status == ${PERSISTED_STATUS.CLOSED}`,
    '| WHERE cases.closed_at >= ? AND cases.closed_at <= ?',
    '| STATS mttr_ms = AVG(cases.duration)'
  ),
  params: [...owner.params, from, to],
});

export const openedVolumeQuery = (owner: OwnerFilter, from: string, to: string): PresetQuery => ({
  pipeline: pipeline(
    owner.stage,
    '| WHERE cases.created_at >= ? AND cases.created_at <= ?',
    '| EVAL bucket = DATE_TRUNC(1 day, cases.created_at)',
    '| STATS opened = COUNT(*) BY bucket',
    '| SORT bucket ASC',
    '| LIMIT 365'
  ),
  params: [...owner.params, from, to],
});

export const closedVolumeQuery = (owner: OwnerFilter, from: string, to: string): PresetQuery => ({
  pipeline: pipeline(
    owner.stage,
    '| WHERE cases.closed_at >= ? AND cases.closed_at <= ?',
    '| EVAL bucket = DATE_TRUNC(1 day, cases.closed_at)',
    '| STATS closed = COUNT(*) BY bucket',
    '| SORT bucket ASC',
    '| LIMIT 365'
  ),
  params: [...owner.params, from, to],
});

export const topAssigneesQuery = (owner: OwnerFilter): PresetQuery => ({
  pipeline: pipeline(
    owner.stage,
    `| WHERE cases.status != ${PERSISTED_STATUS.CLOSED}`,
    '| MV_EXPAND cases.assignees.uid',
    '| WHERE cases.assignees.uid IS NOT NULL',
    '| STATS count = COUNT(*) BY assignee = cases.assignees.uid',
    '| SORT count DESC',
    '| LIMIT 10'
  ),
  params: [...owner.params],
});

export const statusDistributionQuery = (owner: OwnerFilter): PresetQuery => ({
  pipeline: pipeline(owner.stage, '| STATS count = COUNT(*) BY status = cases.status'),
  params: [...owner.params],
});

export const severityDistributionQuery = (owner: OwnerFilter): PresetQuery => ({
  pipeline: pipeline(owner.stage, '| STATS count = COUNT(*) BY severity = cases.severity'),
  params: [...owner.params],
});

export interface EsqlCallArgs {
  soClient: SavedObjectsClientContract;
  spaceId: string;
  query: PresetQuery;
}

export const runEsql = ({ soClient, spaceId, query }: EsqlCallArgs) =>
  soClient.esql({
    type: CASE_SAVED_OBJECT_TYPE,
    namespaces: [spaceId],
    pipeline: query.pipeline,
    params: query.params,
  });
