/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { MappingRuntimeFields } from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import type { BrowserFields, EntityType } from '@kbn/timelines-plugin/common';
import { EventFlyout } from './event';
import { flyoutSelector } from '../common/store/flyout/selectors';
import { closeSecurityFlyout } from '../common/store/flyout/actions';

interface SecurityFlyoutProps {
  browserFields: BrowserFields;
  entityType?: EntityType;
  handleOnFlyoutClosed?: () => void;
  runtimeMappings: MappingRuntimeFields;
  scopeId: string;
  isReadOnly?: boolean;
}

/**
 * This flyout is launched from both the primary security pages as well as the timeline.
 */
export const SecurityFlyout = React.memo(
  ({
    browserFields,
    entityType,
    handleOnFlyoutClosed,
    runtimeMappings,
    scopeId,
    isReadOnly,
  }: SecurityFlyoutProps) => {
    const dispatch = useDispatch();
    const flyout = useSelector(flyoutSelector);

    const closeFlyout = useCallback(() => {
      if (handleOnFlyoutClosed) handleOnFlyoutClosed();
      dispatch(closeSecurityFlyout());
    }, [dispatch, handleOnFlyoutClosed]);

    if (!flyout || !flyout.flyoutKind || !flyout.params) return null;

    let visiblePanel = null; // store in variable to make return statement more readable
    let flyoutUniqueKey: string = scopeId;
    if (flyout?.flyoutKind === 'event') {
      flyoutUniqueKey = flyout.params.eventId;
      visiblePanel = (
        <EventFlyout
          browserFields={browserFields}
          eventDetailParams={flyout?.params}
          closeFlyout={closeFlyout}
          isDraggable={false} // TODO: Determine how we want to handle this functionality
          runtimeMappings={runtimeMappings}
          scopeId={scopeId}
          isReadOnly={isReadOnly}
        />
      );
    }

    return visiblePanel;
  }
);

SecurityFlyout.displayName = 'SecurityFlyout';
