/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback, useMemo } from 'react';
import type { DataViewsPublicPluginStart } from '@kbn/data-views-plugin/public';
import { type DataView } from '@kbn/data-views-plugin/public';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useKibana } from '../../common/lib/kibana';
import { DataViewManagerScopeName, getUseDataViewQueryKey } from '../constants';
import { useIsExperimentalFeatureEnabled } from '../../common/hooks/use_experimental_features';
import { sourcererAdapterSelector } from '../redux/selectors';
import type { SharedDataViewSelectionState } from '../redux/types';
import { dataViewSpecCache } from './spec_cache';

const getDataView = async (
  dataViewId: string,
  internalStatus: SharedDataViewSelectionState['status'],
  dataViewsService: DataViewsPublicPluginStart
) => {
  if (!dataViewId || internalStatus !== 'ready') {
    return undefined;
  }

  dataViewSpecCache.delete(dataViewId); // Clear cache to ensure we get the latest data view

  const currDv = await dataViewsService?.get(dataViewId);
  return currDv;
};

/*
 * This hook should be used whenever we need the actual DataView and not just the spec for the
 * selected data view.
 */
export const useDataView = (
  dataViewManagerScope: DataViewManagerScopeName = DataViewManagerScopeName.default
): {
  dataView: DataView | undefined;
  status: SharedDataViewSelectionState['status'];
} => {
  const {
    services: { dataViews },
    notifications,
  } = useKibana();

  const { dataViewId, status: internalStatus } = useSelector(
    sourcererAdapterSelector(dataViewManagerScope)
  );
  const newDataViewPickerEnabled = useIsExperimentalFeatureEnabled('newDataViewPickerEnabled');
  const queryFn = useCallback(
    () => getDataView(dataViewId as string, internalStatus, dataViews),
    [dataViewId, internalStatus, dataViews]
  );

  const queryKey = useMemo(() => {
    if (!newDataViewPickerEnabled || !dataViewId) {
      return undefined;
    }
    return getUseDataViewQueryKey(dataViewId);
  }, [newDataViewPickerEnabled, dataViewId]);

  const { isError, data, error } = useQuery({
    queryKey, // cast to string since this call is only made when dataViewId is defined
    queryFn,
    enabled: newDataViewPickerEnabled && !!dataViewId,
    keepPreviousData: true,
    placeholderData: undefined,
    staleTime: Infinity,
  });

  if (isError) {
    notifications?.toasts?.danger({
      title: 'Error retrieving data view',
      body: `Error: ${(error as Error)?.message ?? 'unknown'}`,
    });
  }

  return useMemo(() => {
    if (!newDataViewPickerEnabled) {
      return { dataView: undefined, status: internalStatus };
    }
    return {
      dataView: data,
      status: data ? internalStatus : 'loading',
    };
  }, [newDataViewPickerEnabled, data, internalStatus]);
};
