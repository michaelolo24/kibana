/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { estypes } from '@elastic/elasticsearch';
import type { SavedObjectsClientContract } from '@kbn/core/server';

export const CASE_SAVED_OBJECT_TYPE = 'cases';

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

/**
 * Build the owner-filter pipe stage.
 *
 * - `authorizedOwners === undefined` (security disabled) → no stage emitted. All owners implicitly authorized.
 * - `authorizedOwners.length === 0` (security enabled, user has no access) → caller MUST short-circuit
 *   before invoking this; if a query still runs with an empty stage, no owner filter is applied which
 *   would leak cross-owner data. This function returns an empty stage in that case only as a fallback.
 * - `authorizedOwners.length > 0` → `WHERE cases.owner IN (?, ?, ...)` with one `?` per owner.
 */
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

const pipeline = (ownerStage: string, ...stages: string[]): string =>
  `${ownerStage}${stages.map((s) => s.trim()).filter(Boolean).join(' | ')}`.trim();

export const openCasesQuery = (owner: OwnerFilter): PresetQuery => ({
  pipeline: pipeline(owner.stage, '| WHERE cases.status != "closed"', '| STATS count = COUNT(*)'),
  params: [...owner.params],
});

export const unassignedQuery = (owner: OwnerFilter): PresetQuery => ({
  pipeline: pipeline(
    owner.stage,
    '| WHERE cases.status != "closed"',
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
    '| WHERE cases.created_at >= TO_DATETIME(?) AND cases.created_at <= TO_DATETIME(?)',
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
    '| WHERE cases.closed_at >= TO_DATETIME(?) AND cases.closed_at <= TO_DATETIME(?)',
    '| STATS count = COUNT(*)'
  ),
  params: [...owner.params, from, to],
});

export const mttrQuery = (owner: OwnerFilter, from: string, to: string): PresetQuery => ({
  pipeline: pipeline(
    owner.stage,
    '| WHERE cases.status == "closed"',
    '| WHERE cases.closed_at >= TO_DATETIME(?) AND cases.closed_at <= TO_DATETIME(?)',
    '| EVAL duration_ms = DATE_DIFF("ms", cases.created_at, cases.closed_at)',
    '| STATS mttr_ms = AVG(duration_ms)'
  ),
  params: [...owner.params, from, to],
});

export const openedVolumeQuery = (owner: OwnerFilter, from: string, to: string): PresetQuery => ({
  pipeline: pipeline(
    owner.stage,
    '| WHERE cases.created_at >= TO_DATETIME(?) AND cases.created_at <= TO_DATETIME(?)',
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
    '| WHERE cases.closed_at >= TO_DATETIME(?) AND cases.closed_at <= TO_DATETIME(?)',
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
    '| WHERE cases.status != "closed"',
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
