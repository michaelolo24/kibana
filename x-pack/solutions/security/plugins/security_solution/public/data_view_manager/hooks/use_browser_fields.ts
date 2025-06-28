/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useMemo } from 'react';
import type { BrowserFields } from '@kbn/timelines-plugin/common';
import { DataViewManagerScopeName } from '../constants';
import { useDataView } from './use_data_view';
import { getMemoizedGetDataViewStateFromDataViewFields } from '../../common/containers/source/use_data_view';

export const useBrowserFields = (
  scope: DataViewManagerScopeName = DataViewManagerScopeName.default
): BrowserFields => {
  const { dataView } = useDataView(scope);

  return useMemo(() => {
    if (!dataView) {
      return {};
    }

    const getDataViewStateFromDataViewFields = getMemoizedGetDataViewStateFromDataViewFields();
    const { browserFields } = getDataViewStateFromDataViewFields(
      dataView?.title ?? '',
      dataView?.fields
    );

    return browserFields;
  }, [dataView]);
};
