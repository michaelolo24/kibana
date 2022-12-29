/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { isObject } from 'lodash/fp';
import type { AnyAction, Reducer } from 'redux';

type EmptyObject = Record<string | number, never>;

/**
 * @type
 */
export interface SecurityFlyoutModel {
  /**
   * The type of flyout to show (event, host, network, user, etc...)
   */
  flyoutKind?: string;
  /**
   * Any parameters necessary for the initial requests within the flyout
   */
  params?: Record<string, unknown>;
  /**
   * Configuration for the expanded section of the flyout
   */
  expandedSection?: Record<string, unknown>;
}

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

export type ExpandedSectionTabs = 'table' | 'session' | 'analyzer' | 'json';

export interface VisualizeEventExpandedSection extends EventExpandedSection {
  sectionKind: 'visualize';
  params: {
    tab: ExpandedSectionTabs;
  };
}

export interface EventFlyoutState extends SecurityFlyoutModel {
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

// Helper to parse the response from the url, since we don't really know we can trust the shape
export const isValidSecurityFlyout = (flyout: SecurityFlyoutState): boolean => {
  if (!flyout || !isObject(flyout) || !flyout.flyoutKind || !flyout.params) return false;
  if (flyout.flyoutKind === 'event') return !!flyout.params.eventId && !!flyout.params.indexName;
  return false;
};
