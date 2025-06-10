/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useMemo } from 'react';
import type { DataViewSpec, SharedDataViewSelectionState } from '../redux/types';
import { DataViewManagerScopeName } from '../constants';
import { useDataView } from './use_data_view';
import { dataViewSpecCache } from './spec_cache';

export interface UseDataViewSpecResult {
  /**
   * DataViewSpec object for the current dataView
   */
  dataViewSpec: DataViewSpec;
  /**
   * Status of the dataView (can be the following values: 'pristine' | 'loading' | 'error' | 'ready')
   */
  status: SharedDataViewSelectionState['status'];
}

/**
 * Returns an object with the dataViewSpec and status values for the given scopeName.
 */

// TODO: Test passing a select function to useQuery to calculate the dataView.spec() to test the cache behavior
export const useDataViewSpec = (
  scopeName: DataViewManagerScopeName = DataViewManagerScopeName.default,
  // Defaulted to true now to retain the behavior, but this is prohibitively expensive at scale 100k+ fields
  // due to the .toSpec() method on the dataview doing some iterative logic on fields.
  // This should be set to false in the future when we can identify all the places that actually make use of the fields
  includeFields: boolean = true
): UseDataViewSpecResult => {
  const { dataView, status } = useDataView(scopeName);

  if (dataView?.id && !dataViewSpecCache.has(dataView?.id)) {
    // Cache the DataViewSpec to avoid recalculating it every time the hook is called
    dataViewSpecCache.set(dataView?.id, dataView.toSpec?.(includeFields));
  }

  return useMemo(() => {
    // NOTE: remove this after we are ready for undefined (lazy) data view everywhere in the app
    // https://github.com/elastic/security-team/issues/11959
    // every dataView should have the saved object id
    if (!dataView || !dataView.id) {
      return {
        dataViewSpec: {
          id: '',
          title: '',
        },
        status,
      };
    }
    const dataViewSpec = dataViewSpecCache.get(dataView.id) ?? dataView.toSpec?.(includeFields);
    return { dataViewSpec, status };
  }, [dataView, includeFields, status]);
};
