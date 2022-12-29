/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useEffect } from 'react';

import { useSelector } from 'react-redux';
import { useUpdateUrlParam } from '../../utils/global_query_string';
import { URL_PARAM_KEY } from '../use_url_state';
import { flyoutSelector } from '../../store/flyout/selectors';
import type { SecurityFlyoutState } from '../../store/flyout/model';
import { isValidSecurityFlyout } from '../../store/flyout/model';

export const useSyncFlyoutUrlParam = () => {
  const updateUrlParam = useUpdateUrlParam<SecurityFlyoutState>(URL_PARAM_KEY.flyout);
  const flyout = useSelector(flyoutSelector);

  useEffect(() => {
    if (isValidSecurityFlyout(flyout)) {
      updateUrlParam(flyout);
    } else {
      console.log("Updating to be empty!");
      updateUrlParam(null);
    }
  }, [flyout, updateUrlParam]);
};
