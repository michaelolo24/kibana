import { useGlobalTime } from '@kbn/security-solution-plugin/public/common/containers/use_global_time';
import { useGlobalOrTimelineFilters } from '@kbn/security-solution-plugin/public/common/hooks/use_global_or_timeline_filters';
import { Resolver } from '@kbn/security-solution-plugin/public/resolver/view';
import React from 'react';
import { useEventDetailsFlyoutContext } from '../../context';

// TODO: Add full screen

export const ANALYZE_EVENT_ID = 'analyze_event';

export const AnalyzeEvent = () => {
  const {
    selectedPatterns,
    from,
    to,
    shouldUpdate
  } = useGlobalOrTimelineFilters(false);
  const { searchHit } = useEventDetailsFlyoutContext();
  const databaseDocumentID = searchHit?._id as string; // Is the eventID - We won't render without this
  return (
    <Resolver
      databaseDocumentID={databaseDocumentID}
      resolverComponentInstanceID="event-flyout" // TODO: Set explicit instanceId
      indices={selectedPatterns}
      shouldUpdate={shouldUpdate}
      filters={{ from, to }}
    />
  );
};

