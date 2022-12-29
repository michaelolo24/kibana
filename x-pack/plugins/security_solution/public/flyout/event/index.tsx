/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useState } from 'react';
import deepEqual from 'fast-deep-equal';
import type { MappingRuntimeFields } from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { merge } from 'lodash';
import type { BrowserFields } from '../../common/containers/source';
import type { ExpandableFlyoutProps } from '../../common/components/expandable_flyout';
import { ExpandableFlyout } from '../../common/components/expandable_flyout';
import type { ExpandableFlyoutConfig } from './context';
import { EventDetailsFlyoutProvider } from './context';
import { EventDetailsPanel, EventDetailsPanelKey } from './panels/event';
import { expandableFlyoutPanels } from './panels';
import { EventTablePanelKey } from './panels/table';

interface EventFlyoutProps {
  browserFields: BrowserFields;
  eventDetailParams: {
    eventId: string;
    indexName: string;
  };
  closeFlyout: () => void;
  isDraggable?: boolean;
  runtimeMappings: MappingRuntimeFields;
  scopeId: string;
  isReadOnly?: boolean;
}

const EventFlyoutComponent: React.FC<EventFlyoutProps> = ({
  browserFields,
  eventDetailParams,
  closeFlyout,
  isDraggable,
  runtimeMappings,
  scopeId,
  isReadOnly,
}) => {
  const [expandableFlyoutConfig, setExpandableFlyoutConfig] = useState({
    left: { id: null },
    right: { id: EventDetailsPanelKey },
  });

  const updateExpandableFlyoutConfig = useCallback(
    (configUpdate: Partial<ExpandableFlyoutConfig>) =>
      setExpandableFlyoutConfig((prevConfig) => {
        // Need to create a new object to update the reference that a change happened
        return merge({}, prevConfig, configUpdate);
      }),
    []
  );

  if (!eventDetailParams?.eventId) {
    return null;
  }



  return (
    <EventDetailsFlyoutProvider
      closeFlyout={closeFlyout}
      eventId={eventDetailParams.eventId}
      expandableFlyoutConfig={expandableFlyoutConfig}
      indexName={eventDetailParams.indexName}
      updateExpandableFlyoutConfig={updateExpandableFlyoutConfig}
    >
      <ExpandableFlyout
        ownFocus={false}
        onClose={closeFlyout}
        paddingSize="s"
        style={{ zIndex: 1001 }}
        leftSectionActiveId={expandableFlyoutConfig.left.id}
        panels={expandableFlyoutPanels}
        rightSectionCollapsed
        rightSectionActiveId={expandableFlyoutConfig.right.id}
      />
    </EventDetailsFlyoutProvider>
  );
};

export const EventFlyout = React.memo(
  EventFlyoutComponent,
  (prevProps, nextProps) =>
    deepEqual(prevProps.browserFields, nextProps.browserFields) &&
    deepEqual(prevProps.eventDetailParams, nextProps.eventDetailParams) &&
    prevProps.scopeId === nextProps.scopeId &&
    prevProps.isDraggable === nextProps.isDraggable
);
