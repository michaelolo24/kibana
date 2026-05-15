/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { CoreSetup, Logger, SavedObjectsClientContract } from '@kbn/core/server';
import type { TaskManagerStartContract } from '@kbn/task-manager-plugin/server';
import {
  ACTIVITY_INDEX_NAME,
  CASES_ANALYTICS_V2_RECONCILE_RUN_SOON_URL,
  CASES_ANALYTICS_V2_RESET_URL,
  CASES_ANALYTICS_V2_STATE_URL,
  CASE_INDEX_NAME,
} from '../constants';
import { CASE_DATA_VIEW_ID_PREFIX } from '../data_view/data_view_specs';
import { RECONCILIATION_TASK_ID, RECONCILIATION_TASK_TYPE } from '../reconciliation';
import {
  fetchResetTask,
  RESET_TASK_TYPE,
  scheduleResetTask,
  type ResetTaskState,
} from '../reconciliation/reset_task';
import { ensureCaseIndex } from '../ensure_indices/case';
import { ensureActivityIndex } from '../ensure_indices/activity';
import type { CasesAnalyticsV2WriterContract } from '../writer';
import type { CasesActivityV2WriterContract } from '../writer/activity';

/**
 * Shape surfaced under `/state.active_reset` for the live or most-
 * recently-failed reset task. `null` when no reset task SO exists —
 * Task Manager auto-deletes one-shot tasks on success, so `null`
 * means either "no reset has ever been scheduled" or "the last
 * reset succeeded and was cleaned up." A populated value with
 * `status: 'failed'` is the operator's signal that the last reset
 * threw on both surfaces; the periodic task continues to fill in
 * the gap regardless.
 *
 * `state` evolves over the task's lifetime:
 *   - At schedule time (before any throttled write): `{}`.
 *   - During the walk: `phase` + `cases_processed` /
 *     `activity_processed` + `started_at` populate progressively
 *     via the reset task's wall-clock-throttled progress writer.
 *   - At task completion: full `ResetTaskState` written by
 *     Task Manager from the runner's return value, including
 *     `cases_cursor`, `activity_cursor`, `completed_at`, and any
 *     per-surface error messages.
 */
interface ActiveResetSnapshot {
  task_id: string;
  status: string;
  scheduled_at: string;
  /** Most recent attempt count from Task Manager. */
  attempts: number;
  state: Partial<ResetTaskState> | Record<string, never>;
}

const DATA_VIEW_SO_TYPE = 'index-pattern';

/**
 * Authorization shape for every administrator route in this module.
 * **Superuser-only** — these aren't customer-facing, and routing them
 * through a Kibana feature privilege would broaden the attack surface
 * (anyone holding that feature could `/reset` the index). Cluster
 * privilege keeps the model trivial.
 *
 * Not `as const` because `core.http.createRouter`'s `RouteSecurity` shape
 * requires mutable arrays — deep-readonly inference rejects literal
 * assignment otherwise.
 */
const SUPERUSER_AUTHZ = {
  authz: {
    requiredPrivileges: [{ allRequired: ['superuser'] }],
  },
};

interface RegisterArgs {
  core: CoreSetup;
  logger: Logger;
  /**
   * Late-bound — Task Manager's start contract isn't available at setup
   * time. The routes call `getTaskManager()` inside their handlers, so the
   * registration site can pass a closure that resolves once start runs.
   */
  getTaskManager: () => TaskManagerStartContract | null;
  /**
   * Late-bound — the internal SO client is constructed during plugin
   * `start()`, after routes are registered in `setup()`. `/reset` needs an
   * unscoped client to delete per-space `index-pattern` SOs across
   * namespaces; the request-scoped client (`coreContext.savedObjects.client`)
   * is bound by the spaces extension to the requester's namespace and 404s
   * on any data view that lives elsewhere — even with `force: true`,
   * because the spaces extension performs the existence check before
   * delegating the delete.
   */
  getInternalSavedObjectsClient: () => SavedObjectsClientContract | null;
  /**
   * Late-bound — the analytics writer is constructed during plugin
   * `start()` (it holds the live ES client). `/reset` calls
   * `runReconciliation` directly with `lastRunAt: undefined` (bypassing
   * Task Manager's `runSoon` — see the reset handler for the rationale)
   * and needs the writer to dispatch the full re-walk's bulk upserts.
   */
  getWriter: () => CasesAnalyticsV2WriterContract | null;
  /**
   * Activity-surface companion to `getWriter`. Same lifetime + late-bind
   * semantics. `/reset` calls `runActivityReconciliation` directly so a
   * full reset rebuilds both surfaces in one administrator action.
   */
  getActivityWriter: () => CasesActivityV2WriterContract | null;
  /**
   * Wipes the data view service's in-memory "bootstrapped spaces" cache.
   * `/reset` deletes per-space data views directly via the SO API, so the
   * data view sub-service's process-local cache must be cleared too —
   * otherwise it would still believe those spaces had been bootstrapped
   * and skip re-creation on the next request. No-op if v2 hasn't started.
   */
  clearDataViewBootstrapCache: () => void;
  /**
   * Resolved config value for `xpack.cases.analyticsV2.enabled` — surfaced
   * through `/state` so administrators can confirm whether v2 is active.
   */
  enabled: boolean;
  /**
   * Resolved config value for `xpack.cases.analyticsV2.enable_debug_mode`.
   * Gates the **mutating** administrator routes (`/reset` and
   * `/reconcile/run_soon`) at registration time — when false, neither
   * route is registered, and an HTTP request to either path returns 404.
   * The read-only `/state` route is always registered when v2 is on; a
   * future Case Settings page polls it for health info, so gating /state
   * would break that integration.
   *
   * Why route-registration gating (and not a runtime 403): the gated
   * routes operate globally across every space but are invocable from a
   * single space's URL — a misclick from a `default`-space operator
   * wipes case data views in every other space. A 404 makes the gated
   * surface invisible to space-aware tenants that haven't opted in,
   * which is the right default for a debug-only surface.
   */
  enableDebugMode: boolean;
}

/**
 * Administrator support routes for cases-analytics v2. **Superuser-only**
 * (see `SUPERUSER_AUTHZ`); registered directly on `core.http.createRouter()`
 * so they bypass the cases client surface, which doesn't expose the
 * analytics subsystem. Missing dependencies (e.g. Task Manager not yet
 * available) return `503` so callers can retry.
 */
export const registerCasesAnalyticsV2Routes = ({
  core,
  logger,
  getTaskManager,
  getInternalSavedObjectsClient,
  getWriter,
  getActivityWriter,
  clearDataViewBootstrapCache,
  enabled,
  enableDebugMode,
}: RegisterArgs): void => {
  const router = core.http.createRouter();
  const log = logger.get('routes');

  // GET /internal/cases/_analyticsV2/state
  router.get(
    {
      path: CASES_ANALYTICS_V2_STATE_URL,
      // Reading analytics-subsystem health surfaces config + last-tick
      // counters. Doesn't expose case data. See SUPERUSER_AUTHZ for the
      // rationale behind cluster-privilege gating vs a feature privilege.
      security: SUPERUSER_AUTHZ,
      validate: {},
      options: { access: 'internal' },
    },
    async (context, _request, response) => {
      // Pull the live reconciliation task to surface its last run + state
      // (which holds both per-surface cursors + processed counts).
      const taskManager = getTaskManager();
      let lastRun: {
        cases_last_run_at?: string;
        activity_last_run_at?: string;
        runs?: number;
        next_run_at?: string;
        status?: string;
      } | null = null;
      // Live or most-recently-failed reset task. See `ActiveResetSnapshot`
      // for the populated-vs-null semantics.
      let activeReset: ActiveResetSnapshot | null = null;

      if (taskManager != null) {
        try {
          const tasks = await taskManager.fetch({
            query: { bool: { filter: [{ term: { 'task.taskType': RECONCILIATION_TASK_TYPE } }] } },
          });
          const task = tasks.docs[0];
          if (task != null) {
            // Read both per-surface cursors. Falls back to the legacy
            // single-cursor field for tasks scheduled before the activity
            // surface landed (read-only fallback — the runner itself
            // already migrates writes to the new fields on first
            // successful tick).
            const state = (task.state ?? {}) as {
              cases_last_run_at?: string;
              activity_last_run_at?: string;
              last_run_at?: string;
            };
            lastRun = {
              cases_last_run_at: state.cases_last_run_at ?? state.last_run_at,
              activity_last_run_at: state.activity_last_run_at,
              runs: task.attempts,
              next_run_at:
                task.runAt instanceof Date
                  ? task.runAt.toISOString()
                  : (task.runAt as unknown as string),
              status: task.status,
            };
          }
        } catch (err) {
          log.warn(
            `failed to read reconciliation task state: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }

        // Reset task fetch is by ID (singleton). 404 → null (no reset
        // scheduled, or the last one succeeded and Task Manager
        // auto-removed it). A populated value with `status: 'failed'`
        // is how operators detect that the last reset threw — see
        // `RunFunction` rationale in `reset_task.ts`.
        const resetTask = await fetchResetTask({ taskManager, logger: log });
        if (resetTask != null) {
          activeReset = {
            task_id: resetTask.id,
            status: resetTask.status,
            scheduled_at:
              resetTask.scheduledAt instanceof Date
                ? resetTask.scheduledAt.toISOString()
                : (resetTask.scheduledAt as unknown as string),
            attempts: resetTask.attempts,
            // Cast through unknown — Task Manager's `state` is
            // `Record<string, unknown>` at the type layer; we know the
            // shape because we own the task type's runner. While the
            // task is `idle` (just scheduled), `state` is `{}`; while
            // `running`, the reset task's wall-clock-throttled
            // progress writer pushes partial state every ~30s
            // (`phase`, `cases_processed`, `activity_processed`,
            // `started_at`); after the runner returns, it's a fully
            // populated `ResetTaskState` with `phase: 'completed'`
            // (or the partial mid-walk state on a thrown total
            // failure).
            state: (resetTask.state ?? {}) as Partial<ResetTaskState> | Record<string, never>,
          };
        }
      }

      // Check both indices' existence so /state reports each bootstrap's
      // result independently. `ensure*Index` logs-and-continues on
      // failure, so a partial bootstrap (one index up, one missing) is
      // possible — surfacing per-index status here saves a wild-goose
      // chase. Both lookups race in parallel so /state stays cheap.
      let casesIndexExists = false;
      let activityIndexExists = false;
      try {
        const coreContext = await context.core;
        const esClient = coreContext.elasticsearch.client.asInternalUser;
        const [casesExists, activityExists] = await Promise.all([
          esClient.indices.exists({ index: CASE_INDEX_NAME }),
          esClient.indices.exists({ index: ACTIVITY_INDEX_NAME }),
        ]);
        casesIndexExists = casesExists;
        activityIndexExists = activityExists;
      } catch (err) {
        log.warn(
          `failed to check analytics index existence: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }

      return response.ok({
        body: {
          enabled,
          // Per-surface index status. Top-level `index` / `index_exists`
          // retained as backwards-compatible aliases pointing at the
          // cases surface — pre-activity callers reading /state in the
          // wild keep working.
          index: CASE_INDEX_NAME,
          index_exists: casesIndexExists,
          surfaces: {
            cases: {
              index: CASE_INDEX_NAME,
              index_exists: casesIndexExists,
            },
            activity: {
              index: ACTIVITY_INDEX_NAME,
              index_exists: activityIndexExists,
            },
          },
          reconciliation: {
            task_type: RECONCILIATION_TASK_TYPE,
            last_run: lastRun,
          },
          // Live or most-recently-failed reset task. `null` means
          // either "no reset scheduled" or "last reset succeeded and
          // its SO was auto-removed." A populated value with
          // `status: 'failed'` is the failure signal.
          active_reset: activeReset,
        },
      });
    }
  );

  // The two routes below mutate subsystem state cluster-wide and are
  // therefore gated behind `xpack.cases.analyticsV2.enable_debug_mode`.
  // When the flag is off, neither route is registered — requests to
  // these paths return 404. See the `enableDebugMode` JSDoc on
  // `RegisterArgs` for the (route-registration vs runtime-403) rationale.
  if (!enableDebugMode) {
    log.debug(
      'cases-analyticsV2 debug-mode routes (/reset, /reconcile/run_soon) are NOT registered; set xpack.cases.analyticsV2.enable_debug_mode: true to enable.'
    );
    return;
  }

  // POST /internal/cases/_analyticsV2/reconcile/run_soon
  router.post(
    {
      path: CASES_ANALYTICS_V2_RECONCILE_RUN_SOON_URL,
      security: SUPERUSER_AUTHZ,
      validate: {},
      options: { access: 'internal' },
    },
    async (_context, _request, response) => {
      const taskManager = getTaskManager();
      if (taskManager == null) {
        return response.customError({
          statusCode: 503,
          body: { message: 'Task Manager not available; cases-analyticsV2 is likely disabled.' },
        });
      }
      try {
        // `runSoon` expects the task **instance** id (the persisted task SO's
        // id), not the task **type**. The singleton task instance id is
        // exported from the reconciliation module.
        const result = await taskManager.runSoon(RECONCILIATION_TASK_ID);
        return response.ok({ body: { id: RECONCILIATION_TASK_ID, result } });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`reconcile run_soon failed: ${message}`);
        return response.customError({
          statusCode: 500,
          body: { message: `Failed to schedule reconciliation: ${message}` },
        });
      }
    }
  );

  // POST /internal/cases/_analyticsV2/reset
  //
  // Full subsystem reset: drops both analytics indices, recreates them,
  // deletes every per-space `Cases` data view, clears the data view
  // bootstrap cache, then schedules a one-shot Task Manager job to
  // backfill both indices from the SO source of truth. **Returns 202
  // before the backfill begins** — the backfill runs durably in the
  // background and the operator polls `/state.active_reset` for
  // progress / completion.
  //
  // **Why async (vs the previous in-handler walk).** At small/medium
  // tenant sizes the in-handler walk fit inside Kibana's default 120s
  // request timeout, but at 1000+ spaces the walk grew to multi-minute
  // territory and at 10K spaces was estimated 75+ minutes — well past
  // any reasonable HTTP request budget. Moving the walk into a
  // dedicated Task Manager job (`cases.analyticsV2.fullReset`) means:
  //   - `/reset` returns in seconds at any tenant size.
  //   - The walk is durable across Kibana node restarts (Task Manager
  //     re-claims a stuck task on another node).
  //   - Two `/reset` calls can't race — `scheduleResetTask` removes
  //     any in-flight reset task SO before scheduling a fresh one.
  //   - A configurable timeout (`xpack.cases.analyticsV2.resetTaskTimeoutMinutes`)
  //     replaces "implicit HTTP request timeout = walk timeout".
  //   - A configurable inter-page delay (`xpack.cases.analyticsV2.resetPageDelayMs`)
  //     lets operators throttle bulk-write pressure on shared clusters.
  //
  // Steps 1–4 (drop, recreate, delete data views, clear cache) stay
  // in-handler because they're `O(spaces)` not `O(documents)` and
  // benefit from synchronous confirmation that destructive cleanup
  // succeeded before the (much slower) walk begins.
  router.post(
    {
      path: CASES_ANALYTICS_V2_RESET_URL,
      security: SUPERUSER_AUTHZ,
      validate: {},
      options: { access: 'internal' },
    },
    async (context, _request, response) => {
      const taskManager = getTaskManager();
      const coreContext = await context.core;
      const esClient = coreContext.elasticsearch.client.asInternalUser;
      // Per-space data view cleanup needs the unscoped SO client (see
      // `getInternalSavedObjectsClient` JSDoc). The reset task itself
      // resolves writers + SO client from its own getRunnerDeps closure
      // — but we still gate the route on writers being available so
      // operators get a clear 503 here rather than scheduling a task
      // that immediately throws when its getRunnerDeps fires. Same
      // gate as before; the writers themselves are no longer used in
      // the handler body.
      const internalSoClient = getInternalSavedObjectsClient();
      const writer = getWriter();
      const activityWriter = getActivityWriter();
      if (
        internalSoClient == null ||
        writer == null ||
        activityWriter == null ||
        taskManager == null
      ) {
        return response.customError({
          statusCode: 503,
          body: {
            message:
              'cases-analyticsV2 is not ready (writer, activity writer, internal SO client, or task manager unavailable); v2 is likely disabled or still starting.',
          },
        });
      }

      try {
        // 1. Drop existing indices. Both in parallel — they're
        //    independent. 404 is fine on either (reset on an empty
        //    cluster, or only one index ever bootstrapped).
        await Promise.all([
          esClient.indices
            .delete({ index: CASE_INDEX_NAME })
            .catch((err: { meta?: { statusCode?: number }; statusCode?: number }) => {
              const status = err?.statusCode ?? err?.meta?.statusCode;
              if (status === 404) return;
              throw err;
            }),
          esClient.indices
            .delete({ index: ACTIVITY_INDEX_NAME })
            .catch((err: { meta?: { statusCode?: number }; statusCode?: number }) => {
              const status = err?.statusCode ?? err?.meta?.statusCode;
              if (status === 404) return;
              throw err;
            }),
        ]);

        // 2. Recreate both indices via the same bootstrap used at plugin
        //    start. Idempotent and independent; parallel for symmetry
        //    with step 1.
        await Promise.all([
          ensureCaseIndex({ esClient, logger: log }),
          ensureActivityIndex({ esClient, logger: log }),
        ]);

        // 3. Delete every per-space data view. The "Case Analytics" data
        //    view spans both `.cases` and `.cases-activity` so a single
        //    sweep covers both surfaces. See `getInternalSavedObjectsClient`
        //    JSDoc for why the unscoped client is required.
        const deletedDataViews = await deleteAllPerSpaceCasesDataViews(internalSoClient, log);

        // 4. Clear the data view sub-service's in-memory bootstrapped-spaces
        //    cache. Without this, the next request in a previously-bootstrapped
        //    space would skip the ensure check and the user would see no
        //    data view until process restart.
        clearDataViewBootstrapCache();

        // 5. Schedule the one-shot backfill. `scheduleResetTask`
        //    `removeIfExists`-then-schedules so a second `/reset`
        //    call cleanly replaces an in-flight reset (latest-wins
        //    semantics — see the function's JSDoc). The returned
        //    task instance is included in the response so the
        //    operator has the task ID for polling `/state` later.
        const scheduledTask = await scheduleResetTask({ taskManager, logger: log });

        return response.custom({
          // 202 Accepted: the destructive cleanup succeeded
          // synchronously (indices dropped + recreated, data views
          // wiped, cache cleared) — but the backfill walk is still
          // running, so we don't return 200. `/state.active_reset`
          // is the canonical progress + completion surface.
          statusCode: 202,
          body: {
            reset: CASE_INDEX_NAME,
            data_views_deleted: deletedDataViews,
            // The reset task ID + scheduled-at give the operator
            // everything they need to poll `/state.active_reset`
            // and correlate logs.
            reset_task: {
              id: scheduledTask.id,
              task_type: RESET_TASK_TYPE,
              scheduled_at:
                scheduledTask.scheduledAt instanceof Date
                  ? scheduledTask.scheduledAt.toISOString()
                  : (scheduledTask.scheduledAt as unknown as string),
              poll: CASES_ANALYTICS_V2_STATE_URL,
            },
            // Per-surface confirmation of the synchronous bootstrap
            // step. The walk hasn't started yet — `processed` and
            // `next_reconciliation_cursor` will be populated on the
            // task SO once the walk completes.
            surfaces: {
              cases: { reset: CASE_INDEX_NAME },
              activity: { reset: ACTIVITY_INDEX_NAME },
            },
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`reset failed: ${message}`);
        return response.customError({
          statusCode: 500,
          body: { message: `Failed to reset cases-analyticsV2 index: ${message}` },
        });
      }
    }
  );
};

/**
 * Page through every data view SO across every space and delete the ones
 * whose id begins with `CASE_DATA_VIEW_ID_PREFIX`. Returns the count of
 * deletions for the response body. Per-item errors log at WARN and the
 * walk continues — best-effort cleanup is preferred over aborting on a
 * single failure.
 *
 * Two-pass shape:
 *   1. Walk every page of `index-pattern` SOs, collecting only the ids
 *      that match our prefix. No deletes inside the loop.
 *   2. Delete the collected ids.
 * A single-pass implementation that deleted while iterating would shift
 * subsequent page offsets — items at positions `[N*PAGE_SIZE..]` would
 * move onto an already-walked page and be skipped. Since `/reset` is a
 * rare administrator action and missed data views are lazily recreated on
 * the next cases request in that space, this isn't a correctness bug for
 * the user — but it shows up as `data_views_deleted` undercounts in the
 * response and as orphaned SOs in `.kibana`, both of which a tenant-scale
 * `/reset` would surface.
 *
 * Notes:
 *   - **Must be called with an internal (unscoped) SO client.** A request-
 *     scoped client passes through the spaces extension, which scopes
 *     `delete` to the requester's namespace and 404s on any data view that
 *     doesn't live in that exact space — even with `force: true`, because
 *     the spaces extension's existence check runs before delegating the
 *     delete to the underlying repository. The caller (`/reset` handler)
 *     resolves the internal client from the v2 service's start-time
 *     bindings.
 *   - `index-pattern` is a multi-namespace SO type (`namespaceType: 'multiple'`).
 *     **Each delete is issued against the SO's own namespace**, not the
 *     internal client's implicit default. The SO repository's `delete`
 *     preflight (`preflightCheckNamespaces` in
 *     `core/saved-objects/api-server-internal/.../delete.ts`) returns
 *     `found_outside_namespace` and surfaces as a 404 if the SO's
 *     `namespaces` array doesn't include the namespace we pass — and the
 *     internal client's implicit default is `'default'`, so any data view
 *     that lives in `analytics-1`, `analytics-2`, etc. would never be
 *     deletable without this. `force: true` only widens the multi-share
 *     case (SO in N spaces); it does NOT bypass the preflight on the
 *     namespace mismatch. Together they handle every shape — single-space
 *     view (the common case), multi-space share (via `force`), and the
 *     cross-namespace cleanup path (via the explicit namespace arg).
 *   - **404 on delete is treated as success.** An unscoped client should
 *     not normally 404 on an id we just enumerated with its namespace,
 *     but a concurrent `/reset` (or out-of-band SO deletion via the Stack
 *     Management UI) between pass 1 and pass 2 can race the delete. The
 *     desired end state is "data view gone," which the 404 path already
 *     satisfies.
 */
export async function deleteAllPerSpaceCasesDataViews(
  soClient: SavedObjectsClientContract,
  logger: Logger
): Promise<number> {
  const PAGE_SIZE = 100;

  // Pass 1: collect matching ids. Pagination is stable because we don't
  // mutate the index while walking it.
  const targets: Array<{ id: string; namespace: string | undefined }> = [];
  let page = 1;
  while (true) {
    const result = await soClient.find({
      type: DATA_VIEW_SO_TYPE,
      namespaces: ['*'],
      perPage: PAGE_SIZE,
      page,
    });

    for (const so of result.saved_objects) {
      // Only act on data views we manage; everything else is left untouched.
      if (so.id.startsWith(CASE_DATA_VIEW_ID_PREFIX)) {
        targets.push({ id: so.id, namespace: so.namespaces?.[0] });
      }
    }

    if (result.saved_objects.length < PAGE_SIZE) break;
    page++;
  }

  // Pass 2: delete the collected ids. Per-item errors log at WARN and the
  // walk continues — one stuck data view shouldn't block the rest of the
  // cleanup. A 404 is a benign race outcome (concurrent `/reset` or an
  // out-of-band Stack Management deletion between pass 1 and pass 2) so we
  // log it at DEBUG and exclude it from the deletion count (the
  // disappearing-id wasn't deleted by *us*, but the desired end state is
  // satisfied).
  let deleted = 0;
  for (const target of targets) {
    try {
      await soClient.delete(DATA_VIEW_SO_TYPE, target.id, {
        // Tells the SO repository which namespace to run its existence
        // preflight against — see the "each delete is issued against the
        // SO's own namespace" note above. Falls back to `undefined`
        // (= default) for the edge case where a managed data view SO
        // somehow lacks a `namespaces` array; in that situation the
        // existing 404-as-success branch below covers the wrong-default
        // mismatch.
        namespace: target.namespace,
        force: true,
      });
      deleted++;
    } catch (err) {
      if (isSavedObjectNotFoundError(err)) {
        logger.debug(
          `reset: data view ${target.id} (space=${
            target.namespace ?? 'unknown'
          }) already gone by the time we issued delete; treating as success`
        );
        continue;
      }
      logger.warn(
        `reset: failed to delete data view ${target.id} (space=${target.namespace ?? 'unknown'}): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return deleted;
}

/**
 * Detects the saved-objects "not found" surface. The SO API throws
 * `SavedObjectsErrorHelpers.createGenericNotFoundError` (404), but at the
 * SO client boundary the error can land as either a `Boom`-style object
 * with `output.statusCode === 404` or a plain `Error` whose message
 * matches `Saved object [<type>/<id>] not found`. We check all three so
 * test fixtures (which often skip the Boom shape) still take the benign
 * path.
 */
function isSavedObjectNotFoundError(err: unknown): boolean {
  if (err == null) return false;
  const status =
    (err as { statusCode?: number })?.statusCode ??
    (err as { output?: { statusCode?: number } })?.output?.statusCode ??
    (err as { meta?: { statusCode?: number } })?.meta?.statusCode;
  if (status === 404) return true;
  const message = err instanceof Error ? err.message : String(err);
  return /not\s+found/i.test(message);
}
