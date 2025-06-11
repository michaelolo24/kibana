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
import { dataViewSpecCache } from '../utils/data_view_spec_cache';

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
export const useDataViewSpec = (
  scopeName: DataViewManagerScopeName = DataViewManagerScopeName.default,
  // This can be prohibitively expensive with sufficient enough fields and called in enough components
  includeFields: boolean = true
): UseDataViewSpecResult => {
  const { dataView, status } = useDataView(scopeName);

  const cachedSpec = dataViewSpecCache.get(dataView?.id ?? '');
  const shouldUpdateCacheWithFieldsInformation = cachedSpec && !cachedSpec.fields && includeFields;

  if (dataView?.id && (!cachedSpec || shouldUpdateCacheWithFieldsInformation)) {
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
    const dataViewSpec = cachedSpec ?? dataView.toSpec?.(includeFields);
    // TODO: (DV_PICKER) Remove this in the cleanup phase, just here for testing purposes
    dataViewSpecCache.log();
    return { dataViewSpec, status };
  }, [cachedSpec, dataView, includeFields, status]);
};
