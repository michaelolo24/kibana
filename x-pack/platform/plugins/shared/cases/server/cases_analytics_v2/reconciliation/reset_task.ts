/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger, SavedObjectsClientContract } from '@kbn/core/server';
import type {
  ConcreteTaskInstance,
  TaskManagerSetupContract,
  TaskManagerStartContract,
} from '@kbn/task-manager-plugin/server';
import type { CasesAnalyticsV2WriterContract } from '../writer';
import type { CasesActivityV2WriterContract } from '../writer/activity';
import { runFullReset } from './reset_runner';

/**
 * Task type registered with Task Manager for the one-shot full reset.
 * Distinct from `cases.analyticsV2.reconciliation` (the recurring
 * incremental task) so the two get independent timeouts, retry policies,
 * and Task Manager queue accounting. The reset task type's `timeout` is
 * configurable via `xpack.cases.analyticsV2.resetTaskTimeoutMinutes`
 * (default 60m, max 24h) — the recurring task type's timeout is left at
 * Task Manager's default because each periodic tick is `O(delta)` and
 * finishes in seconds at any tenant size.
 */
export const RESET_TASK_TYPE = 'cases.analyticsV2.fullReset';

/**
 * Singleton reset task instance ID. Fixed (not per-`/reset`-call) so a
 * second `/reset` call cleanly cancels and replaces a still-running
 * first call:
 *   1. `/reset` handler calls `scheduleResetTask` →
 *   2. `scheduleResetTask` calls `taskManager.removeIfExists(RESET_TASK_ID)`
 *      — Task Manager removes the SO, which signals any in-flight
 *      runner (next polling cycle).
 *   3. `scheduleResetTask` calls `taskManager.schedule({ id: RESET_TASK_ID, ... })`
 *      to create a fresh instance.
 *
 * If we used a per-call unique ID instead, two `/reset` calls would race
 * concurrent walks on the same indices. Idempotent on `_id` so
 * correctness is fine, but ES would see double the bulk pressure for no
 * benefit. Latest-call-wins via the singleton ID is the right semantic.
 *
 * Exported because `/state` needs the same ID to query the task's status
 * and surface progress under `active_reset`.
 */
export const RESET_TASK_ID = 'cases-analyticsV2-reset';

/**
 * State shape persisted to the reset task SO. The task runner returns
 * this from `run()` so Task Manager writes it to `task.state`. `/state`
 * reads it back to surface progress + outcome.
 *
 * `null` walk results indicate the corresponding surface threw mid-walk
 * (per-surface failure isolation in `runFullReset`); the route layer
 * surfaces this as a partial-success state.
 */
export interface ResetTaskState {
  /** Cases-surface processed count, or null if the surface failed. */
  cases_processed: number | null;
  /** Activity-surface processed count, or null if the surface failed. */
  activity_processed: number | null;
  /** Periodic-task cursors that the runner seeded after both walks. */
  cases_cursor: string;
  activity_cursor: string;
  /** Wall-clock at task-runner entry, for elapsed-time computation. */
  started_at: string;
  /** Wall-clock at task-runner exit. */
  completed_at: string;
  /**
   * Per-surface error message if either walk threw. `null` on success.
   * The runner doesn't propagate the exception (per-surface isolation),
   * so the only way to surface the failure mode in `/state` is to
   * stash the message here.
   */
  cases_error: string | null;
  activity_error: string | null;
  [key: string]: unknown;
}

interface RegisterResetTaskArgs {
  taskManager: TaskManagerSetupContract;
  logger: Logger;
  /**
   * Task `timeout` in minutes. Sourced from
   * `xpack.cases.analyticsV2.resetTaskTimeoutMinutes` (config schema:
   * `defaultValue: 60, min: 5, max: 1440`). Must be set at task-type
   * registration (Task Manager's `timeout` field is not per-instance).
   */
  timeoutMinutes: number;
  /**
   * `xpack.cases.analyticsV2.resetPageDelayMs` — passed through to the
   * reconciliation runners' inter-page sleep. Operators raise this on
   * busy clusters to throttle bulk-write pressure during the backfill.
   * `0` = no throttle (default; runners still yield via `setImmediate`).
   */
  pageDelayMs: number;
  /**
   * Periodic-task cadence, threaded through to `runFullReset` so the
   * post-walk seed step uses the configured interval rather than a
   * hard-coded default.
   */
  reconciliationIntervalMinutes: number;
  /**
   * Late-bound deps. Same closure pattern as the periodic task — Task
   * Manager constructs runners well after plugin `setup()` runs, so we
   * resolve the SO client + writers + TM start contract at run time
   * instead of baking them in at registration.
   *
   * The `taskManager` field here is the START contract (needed by
   * `runFullReset` to seed the periodic task's cursors via
   * `bulkUpdateState`). The SETUP contract (used to register THIS
   * task type) is passed as `taskManager` on the outer
   * `RegisterResetTaskArgs`.
   */
  getRunnerDeps: () => Promise<{
    savedObjectsClient: SavedObjectsClientContract;
    writer: CasesAnalyticsV2WriterContract;
    activityWriter: CasesActivityV2WriterContract;
    taskManager: TaskManagerStartContract;
  }>;
}

/**
 * Registers the one-shot reset task TYPE with Task Manager. Called from
 * plugin `setup()`, alongside `registerReconciliationTask`. Scheduling
 * an instance happens later, on demand from the `/reset` route.
 */
export function registerResetTask({
  taskManager,
  logger,
  timeoutMinutes,
  pageDelayMs,
  reconciliationIntervalMinutes,
  getRunnerDeps,
}: RegisterResetTaskArgs): void {
  taskManager.registerTaskDefinitions({
    [RESET_TASK_TYPE]: {
      title: 'Cases analytics v2 full reset',
      description:
        'One-shot full backfill of the .cases and .cases-activity analytics indices. Scheduled by POST /internal/cases/_analyticsV2/reset; runs the same walks the periodic reconciliation task does, but with lastRunAt: undefined so every doc is re-emitted.',
      // Configurable per-tenant. At 10K spaces / ~15M activity docs,
      // the default 60m is too low — operators raise this in
      // `kibana.yml`. The config schema's `max: 1440` keeps it bounded.
      // String form `Nm` is what Task Manager parses for timeout.
      timeout: `${timeoutMinutes}m`,
      // No auto-retry. A failed reset task SHOULD NOT silently re-run
      // an hour later — the operator should see `active_reset.status:
      // 'failed'` in `/state` and decide whether to re-invoke `/reset`
      // (likely after fixing whatever caused the failure). Auto-retry
      // would also stack a second 60-minute walk on top of an already-
      // stressed cluster — exactly the wrong response to a failure
      // mode whose most likely cause is ES pressure to begin with.
      maxAttempts: 1,
      createTaskRunner: () => ({
        run: async () => {
          // **Why this function THROWS on full failure but RETURNS on
          // success.** Task Manager auto-deletes one-shot tasks (no
          // `schedule.interval`) the moment `run()` returns successfully
          // — see `processResultWhenDone` in
          // `task_running/task_runner.ts`. That's the right behaviour for
          // the happy path (no orphaned task SOs littering
          // `.kibana_task_manager`), but it means `/state.active_reset`
          // returns `null` immediately after completion regardless of
          // outcome. To preserve **failure visibility** in `/state`, we
          // throw on total failure so Task Manager keeps the SO alive
          // with `status: 'failed'`. The operator polling `/state` then
          // sees `active_reset.status === 'failed'` and knows to check
          // logs / re-run `/reset`. On success or partial-success (one
          // surface walked, the other failed), we return — the SO
          // self-deletes, `/state.active_reset` becomes `null`, and the
          // operator interprets that as "the reset completed; if I see
          // the data I expected in Discover, it succeeded."
          //
          // The trade-off: Task Manager metrics show "successful" for
          // partial-failure runs. Acceptable because per-surface
          // failures are already logged at WARN by `runFullReset`, and
          // the affected surface's data either:
          //   - cases: gets re-emitted by the periodic task's
          //     unconditional `updated_at IS NULL` branch
          //   - activity: lands in the next periodic tick from the
          //     seeded cursor onward (older missed user-actions are the
          //     operator's signal to re-run `/reset`)
          const startedAt = new Date().toISOString();
          const deps = await getRunnerDeps();
          const result = await runFullReset({
            savedObjectsClient: deps.savedObjectsClient,
            writer: deps.writer,
            activityWriter: deps.activityWriter,
            taskManager: deps.taskManager,
            intervalMinutes: reconciliationIntervalMinutes,
            pageDelayMs,
            logger,
          });

          const completedAt = new Date().toISOString();
          const casesErrorMessage =
            result.casesError != null
              ? result.casesError instanceof Error
                ? result.casesError.message
                : String(result.casesError)
              : null;
          const activityErrorMessage =
            result.activityError != null
              ? result.activityError instanceof Error
                ? result.activityError.message
                : String(result.activityError)
              : null;

          const state: ResetTaskState = {
            cases_processed: result.cases?.processed ?? null,
            activity_processed: result.activity?.processed ?? null,
            cases_cursor: result.casesCursor,
            activity_cursor: result.activityCursor,
            started_at: startedAt,
            completed_at: completedAt,
            cases_error: casesErrorMessage,
            activity_error: activityErrorMessage,
          };

          // Both surfaces failed → throw so the SO survives with
          // `status: 'failed'` and `state` populated. Task Manager
          // also treats this as a task-level failure for metrics
          // purposes, which is correct: nothing useful happened.
          //
          // We can't actually persist `state` on a thrown failure
          // (Task Manager only writes the state from the returned
          // value), so we encode the per-surface error messages in
          // the thrown error's message — the operator gets enough
          // detail from `/state.active_reset.error` (which Task
          // Manager populates from a failed task's recorded error)
          // to know which surface(s) failed and why.
          if (result.casesError != null && result.activityError != null) {
            throw new Error(
              `cases-analyticsV2: full reset failed on both surfaces. cases: ${casesErrorMessage}. activity: ${activityErrorMessage}`
            );
          }

          // Success or partial success — return so Task Manager
          // self-deletes the SO. The `state` we return is written to
          // the SO momentarily before deletion, so a `/state` call
          // landing in that brief window sees the final counts.
          return { state };
        },
        cancel: async () => {
          // No long-lived resources to release. The runners are SO
          // walks + writer dispatches; canceling Task Manager-side
          // just removes the SO and stops claiming the task on the
          // next polling cycle. The currently-running iteration
          // completes naturally — its bulk dispatches are idempotent
          // on `_id`, so even if a second `/reset` reschedules a
          // fresh task while this one is still finishing, the two
          // walks just dual-write the same docs (extra ES traffic,
          // no correctness impact).
        },
      }),
    },
  });
}

interface ScheduleResetTaskArgs {
  taskManager: TaskManagerStartContract;
  logger: Logger;
}

/**
 * Schedules a one-shot reset task instance. `removeIfExists` first so
 * a second `/reset` call cleanly replaces an in-flight reset rather
 * than racing it (see `RESET_TASK_ID` JSDoc above).
 *
 * Returns the resulting task instance so the caller can include the
 * task ID + scheduled time in the `/reset` 202 response.
 *
 * Throws on schedule failure — caller (the route handler) decides how
 * to respond. Schedule failures are typically Task Manager being
 * unavailable, which is a 503-class problem the operator should see.
 */
export async function scheduleResetTask({
  taskManager,
  logger,
}: ScheduleResetTaskArgs): Promise<ConcreteTaskInstance> {
  // Cancel any in-flight reset by removing its SO. `removeIfExists`
  // swallows the 404 path so first-ever `/reset` (no prior task SO
  // exists) doesn't throw. The currently-running iteration of any
  // already-claimed task finishes on its own — see the `cancel`
  // callback comment above.
  try {
    await taskManager.removeIfExists(RESET_TASK_ID);
  } catch (err) {
    // Non-404 removal failure is non-fatal: the worst case is that
    // the schedule below fails with a version conflict, which the
    // route handler surfaces as a clear 500. Log + continue.
    logger.warn(
      `cases-analyticsV2: failed to remove existing reset task before reschedule: ${
        err instanceof Error ? err.message : String(err)
      }. Will attempt to schedule a fresh task anyway.`
    );
  }

  return taskManager.schedule({
    id: RESET_TASK_ID,
    taskType: RESET_TASK_TYPE,
    params: {},
    state: {},
    // No `schedule.interval` — this is a one-shot. `runAt` defaults to
    // "now" when omitted, so Task Manager picks up the task on its
    // very next polling cycle (default <5s).
  });
}

interface FetchResetTaskArgs {
  taskManager: TaskManagerStartContract;
  logger: Logger;
}

/**
 * Reads the current reset task SO if one exists, for `/state` to
 * surface under `active_reset`. Returns `null` when no reset has been
 * scheduled or the most recent one self-deleted after success.
 *
 * Task Manager doesn't auto-delete completed one-shot tasks — they
 * sit in the SO store with `status: 'idle'` (rescheduled to far-
 * future runAt) or `status: 'failed'`. So a returned task here means
 * "a reset was scheduled at some point and its record still exists";
 * the caller distinguishes "running now" from "already completed" by
 * inspecting `status`.
 */
export async function fetchResetTask({
  taskManager,
  logger,
}: FetchResetTaskArgs): Promise<ConcreteTaskInstance | null> {
  try {
    return await taskManager.get(RESET_TASK_ID);
  } catch (err) {
    // 404 is the common case (no reset has been scheduled yet, or the
    // SO was cleaned up out of band) — treat as "no active reset"
    // rather than a hard error.
    const status =
      (err as { statusCode?: number })?.statusCode ??
      (err as { output?: { statusCode?: number } })?.output?.statusCode;
    if (status === 404) return null;
    logger.warn(
      `cases-analyticsV2: failed to fetch reset task: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return null;
  }
}
