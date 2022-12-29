/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { reducerWithInitialState } from 'typescript-fsa-reducers';
import { initializeSecurityFlyout, closeSecurityFlyout, openSecurityEventFlyout } from './actions';
import type { SecurityFlyoutState } from './model';

export const initialFlyoutState: SecurityFlyoutState = {};

export const flyoutReducer = reducerWithInitialState(initialFlyoutState)
  /**
   * Open the security flyout
   */
  .case(initializeSecurityFlyout, (state, { flyoutKind, params }) => {
    return {
      flyoutKind,
      params,
    };
  })
  /**
   * Open an event flyout
   */
  .case(openSecurityEventFlyout, (state, { flyoutKind, params }) => {
    return {
      flyoutKind,
      params,
    };
  })

  /**
   * Remove all the configuration to close a flyout
   */
  .case(closeSecurityFlyout, () => ({}))
  .build();
