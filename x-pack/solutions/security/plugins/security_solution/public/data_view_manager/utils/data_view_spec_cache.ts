/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { DataViewSpec } from '@kbn/data-views-plugin/common';

/**
 * @description We use a cache here rather than redux because the dataViewSpec is not
 * serializable and we don't want to store it in the redux store.
 * An alternative could be to store it in context of some sort at the top level of the application,
 * but I would rather not mix context and redux for this use case.
 */

export class DataViewSpecCache {
  // Ensure one cache is only ever created
  static #instance: DataViewSpecCache | null = null;
  private cache: Map<string, DataViewSpec> = new Map();

  constructor() {
    if (!DataViewSpecCache.#instance) {
      DataViewSpecCache.#instance = this;
    }
    return DataViewSpecCache.#instance;
  }

  get(dataViewId: string): DataViewSpec | undefined {
    return this.cache.get(dataViewId);
  }

  set(dataViewId: string, dataViewSpec: DataViewSpec): void {
    this.cache.set(dataViewId, dataViewSpec);
  }

  clear(): void {
    this.cache.clear();
  }
  /**
   * Deletes the DataViewSpec from the cache by its ID.
   * @param dataViewId - The ID of the DataViewSpec to delete.
   */
  delete(dataViewId: string): void {
    this.cache.delete(dataViewId);
  }

  has(dataViewId: string): boolean {
    return this.cache.has(dataViewId);
  }

  size(): number {
    return this.cache.size;
  }

  // TODO: (DV_PICKER) Remove this in the cleanup phase, just here for testing purposes
  log(): void {
    console.debug('!!DataViewSpecCache contents:', Array.from(this.cache.entries()));
  }
}

/**
 * @description This cache is used to store the DataViewSpec objects to avoid recalculating them
 * every time the useDataViewSpec hook is called. This is particularly useful
 * when the dataView has a large number of fields, as the toSpec() method can be
 * expensive to compute.
 */
export const dataViewSpecCache = new DataViewSpecCache();
