/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { FlyoutHeader } from './header';

export const EventDetailsPanelKey = 'event_details';

export const EventDetailsPanel: React.FC = React.memo(() => {
  return (
    <>
      <FlyoutHeader />
      {/* <FlyoutBody
        alertId={alertId}
        browserFields={browserFields}
        detailsData={detailsData}
        detailsEcsData={ecsData}
        event={expandedEvent}
        hostName={hostName}
        handleIsolationActionSuccess={handleIsolationActionSuccess}
        handleOnEventClosed={handleOnEventClosed}
        isAlert={isAlert}
        isDraggable={isDraggable}
        isolateAction={isolateAction}
        isIsolateActionSuccessBannerVisible={isIsolateActionSuccessBannerVisible}
        isHostIsolationPanelOpen={isHostIsolationPanelOpen}
        loading={loading}
        rawEventData={rawEventData}
        showAlertDetails={showAlertDetails}
        scopeId={scopeId}
        isReadOnly={isReadOnly}
      />
      <FlyoutFooter
        detailsData={detailsData}
        detailsEcsData={ecsData}
        expandedEvent={expandedEvent}
        refetchFlyoutData={refetchFlyoutData}
        handleOnEventClosed={handleOnEventClosed}
        isHostIsolationPanelOpen={isHostIsolationPanelOpen}
        isReadOnly={isReadOnly}
        loadingEventDetails={loading}
        onAddIsolationStatusClick={showHostIsolationPanel}
        scopeId={scopeId}
      /> */}
    </>
  );
});

EventDetailsPanel.displayName = 'EventDetailsPanel';
