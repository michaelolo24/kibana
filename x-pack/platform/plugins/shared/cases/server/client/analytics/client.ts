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
import type { CasesClientArgs } from '../types';
import { getAnalyticsDashboard } from './get_dashboard';

export interface AnalyticsSubClient {
  getDashboard(params: AnalyticsDashboardRequest): Promise<AnalyticsDashboardResponse>;
}

export const createAnalyticsSubClient = (clientArgs: CasesClientArgs): AnalyticsSubClient => {
  return Object.freeze({
    getDashboard: (params: AnalyticsDashboardRequest) => getAnalyticsDashboard(params, clientArgs),
  });
};
