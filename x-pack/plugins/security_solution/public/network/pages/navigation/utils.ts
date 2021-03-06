/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { GetNetworkRoutePath, NetworkRouteType } from './types';

export const getNetworkRoutePath: GetNetworkRoutePath = (
  capabilitiesFetched,
  hasMlUserPermission
) => {
  if (capabilitiesFetched && !hasMlUserPermission) {
    return `/:tabName(${NetworkRouteType.flows}|${NetworkRouteType.dns}|${NetworkRouteType.http}|${NetworkRouteType.tls}|${NetworkRouteType.alerts})`;
  }

  return (
    `/:tabName(` +
    `${NetworkRouteType.flows}|` +
    `${NetworkRouteType.dns}|` +
    `${NetworkRouteType.anomalies}|` +
    `${NetworkRouteType.http}|` +
    `${NetworkRouteType.tls}|` +
    `${NetworkRouteType.alerts})`
  );
};
