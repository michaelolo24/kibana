/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { UseQueryResult } from '@kbn/react-query';
import { useQuery } from '@kbn/react-query';
import type {
  AnalyticsDashboardRequest,
  AnalyticsDashboardResponse,
} from '../../../common/types/api';
import { useToasts } from '../../common/lib/kibana';
import { casesQueriesKeys } from '../constants';
import * as i18n from '../translations';
import type { ServerError } from '../../types';
import { getAnalyticsDashboard } from './api';

export interface UseGetAnalyticsDashboardArgs {
  from: string;
  to: string;
  enabled?: boolean;
}

export const useGetAnalyticsDashboard = ({
  from,
  to,
  enabled = true,
}: UseGetAnalyticsDashboardArgs): UseQueryResult<AnalyticsDashboardResponse, ServerError> => {
  const toasts = useToasts();

  return useQuery<AnalyticsDashboardResponse, ServerError>(
    casesQueriesKeys.analyticsDashboard({ from, to }),
    ({ signal }) => {
      const body: AnalyticsDashboardRequest = { from, to };
      return getAnalyticsDashboard(body, signal);
    },
    {
      retry: false,
      enabled,
      staleTime: 30_000,
      onError: (error: ServerError) => {
        if (error.name === 'AbortError') return;
        toasts.addError(
          error.body?.message ? new Error(error.body.message) : (error as unknown as Error),
          { title: i18n.ERROR_TITLE }
        );
      },
    }
  );
};
