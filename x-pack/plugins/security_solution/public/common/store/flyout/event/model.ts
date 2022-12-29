/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { AnyAction, Reducer } from 'redux';

type EmptyObject = Record<string | number, never>;

// FLYOUT TYPES

/**
 * NOTE: When adding a flyout state, update isValidSecurityFlyout as this is used to parse the flyout object for storing in the url
 */

export interface EventExpandedSection {
  /**
   * The type of the expanded flyout to show (event, host, network, user, etc...)
   */
  sectionKind?: string;
  /**
   * Any parameters necessary for the expanded section
   */
  params?: Record<string, unknown>;
}

export interface EventFlyoutState {
  flyoutKind?: 'event';
  params?: {
    eventId: string;
    indexName: string;
  };
}

export type SecurityFlyoutState = EventFlyoutState | EmptyObject;

export interface SecurityFlyoutReducer {
  flyout: Reducer<SecurityFlyoutState, AnyAction>;
}