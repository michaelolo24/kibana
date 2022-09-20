/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { TimelineEventsDetailsItem } from '@kbn/timelines-plugin/common';
import { TimelineId } from '@kbn/timelines-plugin/common';
import { PreferenceFormattedDateFromPrimitive } from '../../../../common/components/formatted_date';
import { FlyoutFooter } from '../../../../timelines/components/side_panel/event_details/flyout/footer';
import { HeaderPage } from '../../../../common/components/header_page';
import type { Ecs } from '../../../../../common/ecs';

export const AlertDetailHeader = ({
  detailsData,
  ecsData,
  id,
  isLoading,
  refetch,
  ruleName,
  status,
  timestamp,
}: {
  detailsData: TimelineEventsDetailsItem[] | null;
  ecsData: Ecs | null;
  id: string;
  refetch: () => Promise<void>;
  status: string;
  isLoading: boolean;
  ruleName: string;
  timestamp: string;
}) => {
  return (
    <HeaderPage
      subtitle={<PreferenceFormattedDateFromPrimitive value={timestamp} />}
      title={ruleName}
      rightSideItems={[
        <FlyoutFooter
          detailsData={detailsData}
          detailsEcsData={ecsData}
          expandedEvent={{ eventId: id, indexName: '.alerts-security.alerts-default' }}
          refetchFlyoutData={refetch}
          handleOnEventClosed={() => {}}
          isHostIsolationPanelOpen={false}
          isReadOnly={false}
          loadingEventDetails={isLoading}
          onAddIsolationStatusClick={() => {}}
          timelineId={TimelineId.active}
        />,
      ]}
    />
  );
};
