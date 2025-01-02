/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { SavedObjectsFindOptions, SavedObjectsFindResult } from '@kbn/core/server';
import { SavedObjectsClient, type CoreStart, type Logger } from '@kbn/core/server';
import type { TaskInstance, TaskManagerStartContract } from '@kbn/task-manager-plugin/server';
import { asyncForEach } from '@kbn/std';
import pRetry from 'p-retry';
import type { CasesServerSetupDependencies } from '../../types';
import { CASE_SAVED_OBJECT, CASE_ID_INCREMENTER_SAVED_OBJECT } from '../../../common/constants';
import type { CasePersistedAttributes } from '../../common/types/case';
import type {
  CaseIdIncrementerPersistedAttributes,
  CaseIdIncrementerSavedObject,
} from '../../common/types/id_incrementer';
import type { CasesIncrementIdTaskState } from './task_state';
import { casesIncrementIdStateSchemaByVersion } from './task_state';

export const CASES_INCREMENTAL_ID_SYNC_TASK_TYPE = 'cases_incremental_id';
export const CASES_INCREMENTAL_ID_SYNC_TASK_ID = `Cases:${CASES_INCREMENTAL_ID_SYNC_TASK_TYPE}`;

export const CasesIncrementIdTaskVersion = '1.0.0';
const CASES_INCREMENTAL_ID_SYNC_INTERVAL_DEFAULT = '5m';

const getIncrementalIdFilters = () => {
  const exists = 'cases.attributes.incremental_id: *';
  return {
    exists,
    notExists: 'not cases.attributes.incremental_id: *',
    none: '',
  };
};

export class CasesIncrementalIdService {
  private logger: Logger;
  private core: CoreStart | null = null;

  constructor(plugins: CasesServerSetupDependencies, logger: Logger) {
    this.logger = logger.get('cases', 'incremental_id_service');
    this.logger.info(`Registering Case Incremental ID Service`);

    if (plugins.taskManager) {
      plugins.taskManager.registerTaskDefinitions({
        [CASES_INCREMENTAL_ID_SYNC_TASK_TYPE]: {
          title: 'Cases Incremental ID Service',
          description: 'Task for applying an incremental numeric id to created cases',
          stateSchemaByVersion: casesIncrementIdStateSchemaByVersion,
          createTaskRunner: ({ taskInstance }) => {
            return {
              run: async () => {
                if (!this.core) {
                  this.logger.error('missing necessary dependencies to run task');
                  return undefined;
                }
                const initializedTime = new Date().toISOString();
                const startTime = performance.now();
                this.logger.info(`increment id task started at: ${initializedTime}`);

                const internalSavedObjectsRepository =
                  this.core.savedObjects.createInternalRepository([
                    CASE_SAVED_OBJECT,
                    CASE_ID_INCREMENTER_SAVED_OBJECT,
                  ]);
                const internalSavedObjectsClient = new SavedObjectsClient(
                  internalSavedObjectsRepository
                );

                // Retrieve cases without the incremental_id value set as well as the incrementer
                const { notExists, none } = getIncrementalIdFilters();
                const casesWithoutIncrementalIdResponse = await this.getCases(
                  internalSavedObjectsClient,
                  notExists
                );
                const incrementer = await this.getCaseIdIncrementerSo(internalSavedObjectsClient);
                const casesWithoutIncrementalId = casesWithoutIncrementalIdResponse.saved_objects;

                // Get the numeric values we'll need to know what the final next_id number should be
                const nextIncrementalId = incrementer.attributes.next_id;

                // Option 1 - Update the values in parallel
                const lastAppliedId = await this.updateCasesInParallel(
                  casesWithoutIncrementalId,
                  nextIncrementalId,
                  internalSavedObjectsClient
                );

                // Option 2 - update the values in sequence
                // let lastAppliedCount = await this.updateCasesSequentially(
                //   casesWithoutIncrementalId,
                //   nextIncrementalId,
                //   internalSavedObjectsClient
                // );

                await this.incrementCounter(internalSavedObjectsClient, incrementer, lastAppliedId);

                const endTime = performance.now();

                this.logger.debug(
                  `Completed ${CASES_INCREMENTAL_ID_SYNC_TASK_ID} . Task run took ${
                    endTime - startTime
                  }ms [ stated: ${initializedTime} ]`
                );

                const allCases = await this.getCases(internalSavedObjectsClient, none);
                const newState = structuredClone(taskInstance.state);

                return {
                  state: {
                    ...newState,
                    last_update: {
                      timestamp: startTime,
                      unincremented_cases_count:
                        casesWithoutIncrementalIdResponse.total - casesWithoutIncrementalId.length,
                      total_cases_count: allCases.total,
                      last_applied_id: lastAppliedId,
                      conflict_retry_count: 0, // TODO: implement retry count
                    },
                  },
                };
              },
              cancel: async () => {
                this.logger.warn('Incremental ID task run was canceled');
              },
            };
          },
        },
      });
    }
  }

  private updateCasesInParallel = async (
    casesWithoutIncrementalId: Array<SavedObjectsFindResult<CasePersistedAttributes>>,
    nextIncrementalId: number,
    internalSavedObjectsClient: SavedObjectsClient
  ) => {
    let lastAppliedId = 0;
    const updateCase = async (
      caseSo: SavedObjectsFindResult<CasePersistedAttributes>,
      index: number
    ) => {
      const newId = nextIncrementalId + index;
      await this.applyIncrementalIdToCaseSo(internalSavedObjectsClient, caseSo, newId);
      lastAppliedId = Math.max(lastAppliedId, newId);
    };

    const updateResults = await Promise.allSettled(casesWithoutIncrementalId.map(updateCase));

    // In the event there were any failues to update, we should retry again
    await asyncForEach(updateResults, async (result, index) => {
      if (result.status === 'rejected') {
        const caseSo = casesWithoutIncrementalId[index];
        await updateCase(caseSo, index);
      }
    });

    return lastAppliedId;
  };

  // private updateCasesSequentially = async (
  //   casesWithoutIncrementalId: Array<SavedObjectsFindResult<CasePersistedAttributes>>,
  //   nextIncrementalId: number,
  //   internalSavedObjectsClient: SavedObjectsClient
  // ) => {
  //   let lastAppliedId = 0;
  //   const updateCase = async (
  //     caseSo: SavedObjectsFindResult<CasePersistedAttributes>,
  //     index: number
  //   ) => {
  //     const newId = nextIncrementalId + index;
  //     await this.applyIncrementalIdToCaseSo(internalSavedObjectsClient, caseSo, newId);
  //     lastAppliedId = Math.max(lastAppliedId, newId);
  //   };

  //   await asyncForEach(casesWithoutIncrementalId, async (caseSo, index) => {
  //     await updateCase(caseSo, index);
  //   });

  //   return lastAppliedId;
  // };

  private getCaseIdIncrementerSo = async (savedObjectsClient: SavedObjectsClient) => {
    const incrementerResponse = await savedObjectsClient.find<CaseIdIncrementerPersistedAttributes>(
      {
        type: CASE_ID_INCREMENTER_SAVED_OBJECT,
      }
    );

    // Should not happen, but if more than one incrementer was found don't attempt to guess, just fail the current run.
    // TODO: if this does happen, we should either have a customizable flag to temporary disable this
    // or extend the task time to daily to not run it ever 5m aimlessly till this is resolved
    if (incrementerResponse.saved_objects.length > 1 || incrementerResponse.total > 1) {
      const err = 'Only 1 incrementer should exist per space';
      this.logger.error(err);
      throw new Error(err);
    }
    // If it was never initialized, it should be initialized
    if (incrementerResponse.saved_objects.length === 0 || incrementerResponse.total === 0) {
      const currentTime = new Date().getTime();
      const intializedIncrementalIdSo =
        await savedObjectsClient.create<CaseIdIncrementerPersistedAttributes>(
          CASE_ID_INCREMENTER_SAVED_OBJECT,
          {
            next_id: 1,
            '@timestamp': currentTime,
            updated_at: currentTime,
          }
        );
      return intializedIncrementalIdSo;
    }

    return incrementerResponse.saved_objects[0];
  };

  private incrementCounter = async (
    savedObjectsClient: SavedObjectsClient,
    incrementerSo: CaseIdIncrementerSavedObject,
    lastAppliedId: number
  ) => {
    await savedObjectsClient.update<CaseIdIncrementerPersistedAttributes>(
      CASE_ID_INCREMENTER_SAVED_OBJECT,
      incrementerSo.id,
      {
        next_id: lastAppliedId + 1,
        updated_at: new Date().getTime(),
      },
      {
        version: incrementerSo.version,
      }
    );
  };

  private getCases = async (
    savedObjectsClient: SavedObjectsClient,
    filter: SavedObjectsFindOptions['filter']
  ) => {
    try {
      const savedCases = await savedObjectsClient.find<CasePersistedAttributes>({
        type: CASE_SAVED_OBJECT,
        sortField: 'created_at',
        sortOrder: 'asc',
        perPage: 10000,
        filter,
      });
      return savedCases;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  };

  private applyIncrementalIdToCaseSo = async (
    savedObjectsClient: SavedObjectsClient,
    currentCaseSo: SavedObjectsFindResult<CasePersistedAttributes>,
    newIncrementalId: number
  ) => {
    if (
      currentCaseSo.attributes.incremental_id &&
      typeof currentCaseSo.attributes.incremental_id === 'string' &&
      typeof parseInt(currentCaseSo.attributes.incremental_id, 10) === 'number'
    ) {
      return;
    }

    // We shouldn't have to worry about version conflicts, as we're not modifying any existing fields
    // just applying a new field
    const updateCase = async () => {
      await savedObjectsClient.update<CasePersistedAttributes>(
        CASE_SAVED_OBJECT,
        currentCaseSo.id,
        { incremental_id: `${newIncrementalId}` }
      );
    };

    try {
      await pRetry(updateCase, {
        maxTimeout: 3000,
        retries: 3,
        factor: 2,
        onFailedAttempt: (error) => {
          this.logger.warn(
            `Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`
          );
        },
      });
    } catch (err) {
      this.logger.error('Failed to apply incremental id');
      throw err;
    }
  };

  public async scheduleIncrementIdTask(
    taskManager: TaskManagerStartContract,
    core: CoreStart
  ): Promise<TaskInstance | null> {
    this.core = core;
    try {
      if (!taskManager) {
        this.logger.error(
          `Error running task: ${CASES_INCREMENTAL_ID_SYNC_TASK_ID}. Missing task manager service`
        );
        return null;
      }
      await taskManager.removeIfExists(CASES_INCREMENTAL_ID_SYNC_TASK_ID);
      const internalSavedObjectsRepository = this.core.savedObjects.createInternalRepository([
        CASE_SAVED_OBJECT,
        CASE_ID_INCREMENTER_SAVED_OBJECT,
      ]);
      const internalSavedObjectsClient = new SavedObjectsClient(internalSavedObjectsRepository);
      const { notExists, none } = getIncrementalIdFilters();
      const allCases = await this.getCases(internalSavedObjectsClient, none);
      const casesWithoutIncrementalId = await this.getCases(internalSavedObjectsClient, notExists);

      this.logger.info(`!!!!ALL CASES: ${JSON.stringify(allCases, null, 2)}`);
      this.logger.info(
        `!!!!WITHOUT ID CASES: ${JSON.stringify(casesWithoutIncrementalId, null, 2)}`
      );

      const currentTime = new Date().getTime();
      const initialTaskState: CasesIncrementIdTaskState = {
        on_initialization: {
          timestamp: currentTime,
          unincremented_cases_count: casesWithoutIncrementalId.total,
          total_cases_count: allCases.total,
        },
        last_update: {
          timestamp: currentTime,
          unincremented_cases_count: casesWithoutIncrementalId.total,
          total_cases_count: allCases.total,
          conflict_retry_count: 0,
          last_applied_id: null,
        },
      };

      const taskInstance = await taskManager.ensureScheduled({
        id: CASES_INCREMENTAL_ID_SYNC_TASK_ID,
        taskType: CASES_INCREMENTAL_ID_SYNC_TASK_TYPE,
        schedule: {
          interval: CASES_INCREMENTAL_ID_SYNC_INTERVAL_DEFAULT,
        },
        params: {},
        state: initialTaskState,
        scope: ['cases'],
      });

      this.logger.info(
        `${CASES_INCREMENTAL_ID_SYNC_TASK_ID} scheduled with interval ${taskInstance.schedule?.interval}`
      );

      return taskInstance;
    } catch (e) {
      this.logger.error(
        `Error running task: ${CASES_INCREMENTAL_ID_SYNC_TASK_ID}: ${e}`,
        e?.message ?? e
      );
      return null;
    }
  }
}

// Constructor

// Find cases without incremental id
// Find a counter that
