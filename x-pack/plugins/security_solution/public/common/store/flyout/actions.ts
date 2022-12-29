/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import actionCreatorFactory from 'typescript-fsa';
import type { EventFlyoutState, SecurityFlyoutState } from './model';

const actionCreator = actionCreatorFactory('x-pack/security_solution/local/flyout');

export const initializeSecurityFlyout =
  actionCreator<Required<SecurityFlyoutState>>('INITIALIZE_FLYOUT');

export const openSecurityEventFlyout = actionCreator<EventFlyoutState>('OPEN_EVENT_FLYOUT');

export const closeSecurityFlyout = actionCreator('CLOSE_FLYOUT');
