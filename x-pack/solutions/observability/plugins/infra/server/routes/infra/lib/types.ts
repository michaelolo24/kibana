/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ApmDataAccessServicesWrapper } from '../../../lib/helpers/get_apm_data_access_client';
import type { GetInfraMetricsRequestBodyPayload } from '../../../../common/http_api/infra';
import type { InfraAlertsClient } from '../../../lib/helpers/get_infra_alerts_client';
import type { InfraMetricsClient } from '../../../lib/helpers/get_infra_metrics_client';

export interface GetHostParameters extends GetInfraMetricsRequestBodyPayload {
  infraMetricsClient: InfraMetricsClient;
  alertsClient: InfraAlertsClient;
  apmDataAccessServices?: ApmDataAccessServicesWrapper;
}
