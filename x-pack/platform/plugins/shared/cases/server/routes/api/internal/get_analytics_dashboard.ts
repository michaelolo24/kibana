/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';

import type { analyticsApiV1 } from '../../../../common/types/api';
import { INTERNAL_ANALYTICS_DASHBOARD_URL } from '../../../../common/constants';
import { createCaseError } from '../../../common/error';
import { createCasesRoute } from '../create_cases_route';
import { DEFAULT_CASES_ROUTE_SECURITY } from '../constants';

const isoDateString = schema.string({
  minLength: 1,
  validate: (value) => {
    if (Number.isNaN(Date.parse(value))) {
      return 'must be a valid ISO 8601 date string';
    }
  },
});

export const getAnalyticsDashboardRoute = createCasesRoute({
  method: 'post',
  path: INTERNAL_ANALYTICS_DASHBOARD_URL,
  security: DEFAULT_CASES_ROUTE_SECURITY,
  routerOptions: {
    access: 'internal',
  },
  params: {
    body: schema.object(
      {
        from: isoDateString,
        to: isoDateString,
      },
      {
        validate: ({ from, to }) => {
          if (Date.parse(from) > Date.parse(to)) {
            return '"from" must be on or before "to"';
          }
        },
      }
    ),
  },
  handler: async ({ context, request, response }) => {
    try {
      const caseContext = await context.cases;
      const client = await caseContext.getCasesClient();
      const body = request.body as analyticsApiV1.AnalyticsDashboardRequest;

      const responseBody: analyticsApiV1.AnalyticsDashboardResponse =
        await client.analytics.getDashboard(body);

      return response.ok({
        body: responseBody,
      });
    } catch (error) {
      throw createCaseError({
        message: `Failed to get cases analytics dashboard in route: ${error}`,
        error,
      });
    }
  },
});
