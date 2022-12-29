/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useInitFlyoutFromUrlParam } from './use_init_flyout_url_params';
import { useSyncFlyoutUrlParam } from './use_sync_flyout_url_params';

export const useFlyoutUrlStateSync = () => {
  useInitFlyoutFromUrlParam();
  useSyncFlyoutUrlParam();
};
