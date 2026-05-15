/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger, SavedObjectsClientContract } from '@kbn/core/server';
import type { TaskManagerStartContract } from '@kbn/task-manager-plugin/server';
import type { CasesAnalyticsV2WriterContract } from '../writer';
import type { CasesActivityV2WriterContract } from '../writer/activity';
import { runReconciliation, type RunReconciliationResult } from './runner';
import {
  runActivityReconciliation,
  type RunActivityReconciliationResult,
} from './activity_runner';
import { resetReconciliationTask } from './index';

/**
 * Inputs for `runFullReset`. The shape mirrors the late-bound deps the
 * `/reset` route already resolves at request time, so the new one-shot
 * reset task can plug in the same resolved values from the v2 service's
 * start-time bindings without re-deriving any of them.
 */
export interface RunFullResetDeps {
  /** Internal (no request scope) SO client. Same one the periodic task uses. */
  savedObjectsClient: SavedObjectsClientContract;
  /** Cases-surface writer. Real instance, not the noop. */
  writer: CasesAnalyticsV2WriterContract;
  /** Activity-surface writer. Real instance, not the noop. */
  activityWriter: CasesActivityV2WriterContract;
  /**
   * Task Manager start contract. Used after both walks complete to
   * atomically reset the periodic reconciliation task's persisted state
   * — see `resetReconciliationTask` in `./index.ts` for the rationale
   * behind the `bulkUpdateState` (vs `remove`+`schedule`) approach.
   *
   * Optional because the `/reset` route's pre-extraction code path made
   * the same call conditional on TM availability — preserving that
   * fallback keeps the extraction strictly equivalence-preserving.
   */
  taskManager: TaskManagerStartContract | null;
  /** Periodic-task cadence; threaded through to `resetReconciliationTask`. */
  intervalMinutes: number;
  /**
   * Inter-page sleep for the reconciliation runners, in milliseconds.
   * Plumbed through from `xpack.cases.analyticsV2.resetPageDelayMs`. The
   * runners default to `0` (yield via `setImmediate`); operators raise
   * this on busy clusters to throttle bulk-write pressure during the
   * full backfill.
   */
  pageDelayMs: number;
  /**
   * Optional progress callback fired after each runner page completes.
   * `phase` discriminates which surface is currently being walked so
   * the caller (the reset task) can write per-surface live counts into
   * the task SO. `processed` is the cumulative count for the current
   * surface — the caller writes the latest value into its `phase`-
   * prefixed state field without per-page bookkeeping.
   *
   * Synchronous + non-blocking. Callers throttle their downstream I/O
   * (e.g. `bulkUpdateState`) themselves; this function does NOT
   * throttle on their behalf so per-page semantics stay obvious.
   */
  onProgress?: (info: { phase: 'cases' | 'activity'; processed: number }) => void;
  logger: Logger;
}

export interface RunFullResetResult {
  /** Per-surface walk outcomes. `null` indicates that surface's walk threw mid-flight. */
  cases: RunReconciliationResult | null;
  activity: RunActivityReconciliationResult | null;
  /**
   * ISO timestamp seeded into the periodic task's cases-surface cursor.
   * Falls back to wall-clock-now when the cases walk failed (the next
   * tick walks only forward from this point on the cases surface;
   * never-patched cases still get caught by the runner's
   * `updated_at IS NULL` branch — see the cases runner's docstring).
   */
  casesCursor: string;
  /** Same shape as `casesCursor`, for the activity surface. */
  activityCursor: string;
  /**
   * Per-walk error captured for surface-level isolation. `null` on
   * success. Surfaced so callers can decide whether to log / report a
   * partial failure — the function itself never throws on a per-surface
   * walk error (matches the route's pre-extraction behaviour, which
   * logged-and-continued so the SUCCESSFUL surface's cursor still got
   * seeded).
   */
  casesError: unknown;
  activityError: unknown;
}

/**
 * The walk-and-seed phase of a full subsystem reset. Extracted from the
 * `/reset` route so the same logic can be invoked from a one-shot
 * Task Manager job (`cases.analyticsV2.fullReset`) — that job is what
 * lets `/reset` return 202 in seconds at large-tenant scale instead of
 * timing out the HTTP request mid-walk.
 *
 * **What this function does NOT do.** Steps 1–4 of `/reset` (drop
 * indices, recreate indices, delete per-space data views, clear the
 * bootstrap cache) stay in the `/reset` handler. Those are `O(spaces)`,
 * fast, and benefit from running synchronously inside the request so
 * the operator gets immediate confirmation that destructive cleanup
 * succeeded before the (much slower) walk begins. Only the
 * `O(documents)` walk + cursor-seeding moves here.
 *
 * **Per-surface failure isolation.** A failure on one surface logs at
 * WARN, captures the error in the result, and lets the other surface
 * proceed. The seed step always runs — we'd rather seed the periodic
 * cursor for the surface that succeeded than throw away its progress
 * because the other surface had trouble.
 *
 * **No throw on cursor-seed failure.** A `bulkUpdateState` failure
 * after both walks have already happened is the worst-case "indices
 * are populated but the periodic task will re-walk the whole tenant
 * on its next tick" scenario — annoying, but not data-corrupting.
 * Logged at WARN; we still return success.
 */
export async function runFullReset({
  savedObjectsClient,
  writer,
  activityWriter,
  taskManager,
  intervalMinutes,
  pageDelayMs,
  onProgress,
  logger,
}: RunFullResetDeps): Promise<RunFullResetResult> {
  // Cases first, then activity. Same ordering rationale as the periodic
  // task: a `LOOKUP JOIN .cases ON cases.id` from any post-activity
  // consumer always sees the joined case row at least as up-to-date as
  // the activity row that referenced it.
  let casesResult: RunReconciliationResult | null = null;
  let casesError: unknown = null;
  try {
    casesResult = await runReconciliation({
      savedObjectsClient,
      writer,
      logger,
      lastRunAt: undefined,
      pageDelayMs,
      // Synthesize per-surface phase by wrapping the runner's
      // surface-agnostic callback. Keeps the runners themselves
      // free of any "which surface am I" awareness.
      onPageComplete: ({ processed }) => onProgress?.({ phase: 'cases', processed }),
    });
  } catch (err) {
    casesError = err;
    logger.warn(
      `reset: full cases re-walk failed mid-flight: ${
        err instanceof Error ? err.message : String(err)
      }. Index is partially populated; the periodic reconciliation task will continue to fill it in.`
    );
  }

  let activityResult: RunActivityReconciliationResult | null = null;
  let activityError: unknown = null;
  try {
    activityResult = await runActivityReconciliation({
      savedObjectsClient,
      activityWriter,
      logger,
      lastRunAt: undefined,
      pageDelayMs,
      onPageComplete: ({ processed }) => onProgress?.({ phase: 'activity', processed }),
    });
  } catch (err) {
    activityError = err;
    logger.warn(
      `reset: full activity re-walk failed mid-flight: ${
        err instanceof Error ? err.message : String(err)
      }. Activity index is partially populated; the periodic reconciliation task will continue to fill it in.`
    );
  }

  // Per-surface fallback to wall-clock-now when a surface's walk failed.
  // Pinning to "now" is correct because:
  //   - On the cases side, the runner's `updated_at IS NULL` branch
  //     unconditionally re-emits never-patched cases on every tick, so
  //     anything missed during the failed walk still gets caught.
  //   - On the activity side, user actions are immutable (`created_at`-
  //     only filter), so any user actions created during the failed walk
  //     fall into the next tick's window naturally. User actions created
  //     BEFORE the walk that the walk didn't reach do stay un-mirrored
  //     until manually re-walked — this is acceptable here because the
  //     operator will see the WARN log and decide whether to re-run
  //     `/reset` (the durable fix) or rely on incremental forward
  //     progress.
  const casesCursor = casesResult?.newLastRunAt ?? new Date().toISOString();
  const activityCursor = activityResult?.newLastRunAt ?? new Date().toISOString();

  if (taskManager != null) {
    try {
      await resetReconciliationTask({
        taskManager,
        logger,
        intervalMinutes,
        initialState: {
          cases_last_run_at: casesCursor,
          activity_last_run_at: activityCursor,
        },
      });
    } catch (err) {
      logger.warn(
        `reset: failed to seed reconciliation cursors: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return {
    cases: casesResult,
    activity: activityResult,
    casesCursor,
    activityCursor,
    casesError,
    activityError,
  };
}
