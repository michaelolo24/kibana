/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SortResults } from '@elastic/elasticsearch/lib/api/types';
import type { Logger, SavedObjectsClientContract, SavedObjectsFindResult } from '@kbn/core/server';
import { nodeBuilder } from '@kbn/es-query';
import { CASE_USER_ACTION_SAVED_OBJECT } from '../../../common/constants';
import type { UserActionPersistedAttributes } from '../../common/types/user_actions';
import type { CasesActivityV2WriterContract } from '../writer/activity';

/**
 * Maximum number of user-action SOs fetched per ES round-trip. Aligned
 * with the cases runner's page size (100) — initially set to 200 on the
 * theory that user-actions are smaller than cases, but the per-page sync
 * CPU (doc-build + ES client NDJSON serialization) is dominated by the
 * `JSON.stringify(payload)` for the polymorphic `payload` field, which
 * can be large for bulk-attachment or push payloads. 100 keeps the
 * worst-case sync span between event-loop yields bounded; throughput is
 * limited by ES bulk roundtrip latency, not page count.
 */
const PAGE_SIZE = 100;

/**
 * Sentinel SO-namespaces value meaning "every namespace". Same rationale
 * as the cases runner — the unscoped internal client defaults to the
 * `default` namespace; explicit `['*']` opts every space in. Keep the
 * value identical to the cases runner's sentinel so future changes
 * (e.g. tightening the contract) catch both surfaces in one search.
 */
const NAMESPACES_ALL: string[] = ['*'];

/**
 * Cap on the per-space breakdown the summary log reports. Heavy-tenant
 * clusters (1000+ spaces) would otherwise produce log lines large enough
 * to break ingest pipelines; capping keeps the line readable while still
 * surfacing the top contributors to a noisy tick.
 */
const SUMMARY_TOP_N_SPACES = 25;

export interface RunActivityReconciliationDeps {
  /** Internal SO client (no request scope). Used to walk every user action across every space. */
  savedObjectsClient: SavedObjectsClientContract;
  activityWriter: CasesActivityV2WriterContract;
  logger: Logger;
  /**
   * ISO timestamp from the previous successful tick — only user actions
   * created AFTER this point are walked. `undefined` on the first run, in
   * which case the runner walks every user action (backfill mode). To
   * force a backfill later, an administrator hits `/reset`.
   */
  lastRunAt: string | undefined;
  /**
   * Optional sleep between pages, in milliseconds. Default `0`. Same
   * semantics and rationale as the cases runner — see its `pageDelayMs`
   * docs. The activity surface is the heavier of the two by ~15× in
   * measured tenants, so this knob has more impact on the activity
   * walk's wall-clock than on the cases walk.
   */
  pageDelayMs?: number;
}

export interface RunActivityReconciliationResult {
  /** ISO timestamp to persist as the next `last_run_at`. */
  newLastRunAt: string;
  /** Count of user actions re-emitted during the tick. */
  processed: number;
}

/**
 * Activity reconciliation tick. Walks every user-action saved object
 * created since the last successful tick and re-emits its analytics doc
 * via the writer.
 *
 * **Why this is `created_at`-only.** User actions are immutable at the SO
 * layer — once written, they're never patched. There is no `updated_at`
 * field to consult; the cases runner's `updated_at IS NULL` branch (which
 * exists to catch never-patched cases) doesn't apply. A single
 * `created_at > lastRunAt` clause is both necessary and sufficient.
 *
 * **Cascade-on-case-delete is NOT handled here.** When a case is deleted,
 * its user-actions SOs are cascaded by the SO layer; reconciliation walks
 * forward in time from the cursor and never sees the gap. The activity
 * writer's `bulkDeleteActionsByCaseIds` path (called from
 * `CasesService.deleteCase` and `bulkDeleteCaseEntities`) is the only
 * path that drops orphaned analytics docs. If we ever lose those
 * cascades, the activity index ends up with stale rows — and there's no
 * cheap way to detect that here without re-walking every SO.
 */
export async function runActivityReconciliation({
  savedObjectsClient,
  activityWriter,
  logger,
  lastRunAt,
  pageDelayMs = 0,
}: RunActivityReconciliationDeps): Promise<RunActivityReconciliationResult> {
  // Capture the wall-clock at tick start. Persisted as the new cursor on
  // a successful drain so the next tick sees only user actions created
  // *after* this moment. Captured before any I/O so user actions
  // created while the tick is running fall into the next window.
  const tickStartedAt = new Date().toISOString();

  // Single clause — see "created_at-only" rationale in the function docstring.
  const filter = lastRunAt
    ? nodeBuilder.range(
        `${CASE_USER_ACTION_SAVED_OBJECT}.attributes.created_at`,
        'gt',
        lastRunAt
      )
    : undefined;

  // Open a PIT (Point-In-Time) so paging is consistent against a fixed
  // snapshot of the index — concurrent writes don't shift our results.
  // `namespaces: NAMESPACES_ALL` is required for the same reason as in
  // the cases runner: an unscoped client otherwise scopes to `default`.
  const pit = await savedObjectsClient.openPointInTimeForType(CASE_USER_ACTION_SAVED_OBJECT, {
    namespaces: NAMESPACES_ALL,
  });

  let processed = 0;
  let searchAfter: SortResults | undefined;
  // Per-space counts for the summary log line. Same rationale as the
  // cases runner — heavy-tenant clusters benefit from "where did this
  // tick's volume come from" being in the log line itself.
  const processedBySpace = new Map<string, number>();

  try {
    while (true) {
      const page = await savedObjectsClient.find<UserActionPersistedAttributes>({
        type: CASE_USER_ACTION_SAVED_OBJECT,
        filter,
        // **Must** pass `namespaces: ['*']` here even though our SO client
        // is the unscoped internal client. See the cases runner for the
        // detailed explanation; the symptom is identical (every user
        // action in every non-default space gets silently skipped).
        namespaces: NAMESPACES_ALL,
        // No `sortField` — defaults to `_shard_doc` under PIT (unique per
        // doc, optimal for searchAfter walks). User-action analytics docs
        // are idempotent on `_id`, so traversal order isn't meaningful.
        perPage: PAGE_SIZE,
        pit: { id: pit.id },
        searchAfter,
      });

      if (page.saved_objects.length === 0) {
        break;
      }

      // Dispatch the entire page as a single `_bulk` request and **await**
      // its completion before fetching the next page. Same rationale as
      // the cases runner — bounded concurrency, single round-trip per
      // page, and `bulkUpsertActionsAwait` propagates retryable failures
      // so a transient blip pins the cursor and forces a re-walk.
      await activityWriter.bulkUpsertActionsAwait(page.saved_objects);

      for (const so of page.saved_objects) {
        processed++;
        const space = so.namespaces?.[0] ?? 'default';
        processedBySpace.set(space, (processedBySpace.get(space) ?? 0) + 1);
      }

      searchAfter = getLastSort(page.saved_objects);

      if (page.saved_objects.length < PAGE_SIZE) {
        break;
      }

      // Yield to the event loop between pages — see the matching comment
      // in `runner.ts` for the full rationale. The activity surface is
      // the heaviest reconciliation surface (user-actions outnumber
      // cases ~15:1 in measured tenants), so this yield matters more
      // here than on the cases runner: a backfill walk is otherwise a
      // many-page-back-to-back sync-CPU train inside a single handler.
      if (pageDelayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, pageDelayMs));
      } else {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }
  } finally {
    // Always close the PIT — leaked PITs hold ES resources until they expire.
    await savedObjectsClient.closePointInTime(pit.id);
  }

  const perSpaceSummary = formatTopSpaces(processedBySpace);

  logger.info(
    `cases-analyticsV2: activity reconciliation processed=${processed}${perSpaceSummary} lastRunAt=${
      lastRunAt ?? '<none>'
    } newLastRunAt=${tickStartedAt}`
  );

  return { newLastRunAt: tickStartedAt, processed };
}

function getLastSort<T>(results: Array<SavedObjectsFindResult<T>>): SortResults | undefined {
  return results[results.length - 1]?.sort;
}

/**
 * Format the top-N per-space counts as ` by_space={a=10, b=8, ...}` for
 * the summary log. Returns an empty string when no docs were processed.
 *
 * Mirrors the cases runner's helper exactly; not extracted because the
 * surfaces evolve independently and a shared helper invites accidental
 * coupling — see the same note in the cases runner.
 */
function formatTopSpaces(processedBySpace: Map<string, number>): string {
  if (processedBySpace.size === 0) return '';

  const top: Array<[string, number]> = [];
  for (const entry of processedBySpace) {
    if (top.length < SUMMARY_TOP_N_SPACES) {
      top.push(entry);
      continue;
    }
    let minIdx = 0;
    for (let i = 1; i < top.length; i++) {
      if (top[i][1] < top[minIdx][1]) minIdx = i;
    }
    if (entry[1] > top[minIdx][1]) top[minIdx] = entry;
  }
  top.sort((a, b) => b[1] - a[1]);

  let summary = ' by_space={';
  for (let i = 0; i < top.length; i++) {
    if (i > 0) summary += ', ';
    summary += `${top[i][0]}=${top[i][1]}`;
  }
  if (processedBySpace.size > SUMMARY_TOP_N_SPACES) {
    summary += `, ... +${processedBySpace.size - SUMMARY_TOP_N_SPACES} more`;
  }
  summary += '}';
  return summary;
}
