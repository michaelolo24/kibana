/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  AnalyticsDashboardRequest,
  AnalyticsDashboardResponse,
} from '../../../common/types/api';
import { INTERNAL_ANALYTICS_DASHBOARD_URL } from '../../../common/constants';
import { KibanaServices } from '../../common/lib/kibana';

export const getAnalyticsDashboard = async (
  body: AnalyticsDashboardRequest,
  signal?: AbortSignal
): Promise<AnalyticsDashboardResponse> => {
  return KibanaServices.get().http.fetch<AnalyticsDashboardResponse>(
    INTERNAL_ANALYTICS_DASHBOARD_URL,
    {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    }
  );
};
