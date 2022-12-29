/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import type { SearchHit } from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { noop } from 'lodash/fp';
import { BrowserFields } from '@kbn/security-solution-plugin/common/search_strategy';
import { SecurityPageName } from '../../../common/constants';
import type { Ecs } from '../../../common/ecs';
import type { TimelineEventsDetailsItem } from '../../../common/search_strategy/timeline';
import { getAlertIndexAlias } from './helpers';
import { useSpaceId } from '../../common/hooks/use_space_id';
import type { EventFlyoutState } from '../../common/store/flyout/model';
import { useTimelineEventsDetails } from '../../timelines/containers/details';
import { useGetFieldsData } from '../../common/hooks/use_get_fields_data';
import { getFieldBrowserFormattedValue } from './utils/get_field_browser_formatted_value';
import { useRouteSpy } from '../../common/utils/route/use_route_spy';
import { SourcererScopeName } from '../../common/store/sourcerer/model';
import { useSourcererDataView } from '../../common/containers/sourcerer';

export interface ExpandableFlyoutConfig {
  left: { id: string | null };
  right: { id: string | null };
}

interface EventDetailsFlyoutContextValues {
  browserFields: BrowserFields | null;
  closeFlyout: () => void;
  dataAsNestedObject: Ecs | null;
  dataFormattedForFieldBrowser: TimelineEventsDetailsItem[] | null;
  expandableFlyoutConfig: ExpandableFlyoutConfig;
  getData: ({ category, field }: { category: string; field: string }) => string | void;
  getFieldsData: (field: string) => unknown | unknown[];
  refetchFlyoutData: () => Promise<void> | void;
  searchHit: SearchHit<object> | undefined;
  updateExpandableFlyoutConfig: (configUpdate: Partial<ExpandableFlyoutConfig>) => void;
}

const EventDetailsFlyoutContext = createContext<EventDetailsFlyoutContextValues>({
  browserFields: null,
  closeFlyout: noop,
  dataAsNestedObject: null,
  dataFormattedForFieldBrowser: null,
  expandableFlyoutConfig: { left: { id: null }, right: { id: null } },
  getData: noop,
  getFieldsData: noop,
  refetchFlyoutData: noop,
  searchHit: undefined,
  updateExpandableFlyoutConfig: noop,
});

type EventDetailsFlyoutProviderProps = {
  closeFlyout: () => void;
  expandableFlyoutConfig: ExpandableFlyoutConfig;
  updateExpandableFlyoutConfig: EventDetailsFlyoutContextValues['updateExpandableFlyoutConfig'];
  children: React.ReactNode;
} & EventFlyoutState['params'];

export const EventDetailsFlyoutProvider = ({
  closeFlyout,
  expandableFlyoutConfig,
  eventId,
  indexName,
  updateExpandableFlyoutConfig,
  children,
}: EventDetailsFlyoutProviderProps) => {
  const currentSpaceId = useSpaceId();
  const [{ pageName }] = useRouteSpy();
  const sourcererScope =
    pageName === SecurityPageName.detections
      ? SourcererScopeName.detections
      : SourcererScopeName.default;
  const sourcererDataView = useSourcererDataView(sourcererScope);
  const eventIndex = getAlertIndexAlias(indexName, currentSpaceId) ?? indexName;

  const [loading, dataFormattedForFieldBrowser, searchHit, dataAsNestedObject, refetchFlyoutData] =
    useTimelineEventsDetails({
      indexName: eventIndex ?? '',
      eventId: eventId ?? '',
      runtimeMappings: sourcererDataView.runtimeMappings,
      skip: !eventId,
    });

  const getData = useCallback(
    ({ category, field }: { category: string; field: string }) =>
      getFieldBrowserFormattedValue({ category, field }, dataFormattedForFieldBrowser),
    [dataFormattedForFieldBrowser]
  );

  const getFieldsData = useGetFieldsData(searchHit?.fields);

  const contextValue = useMemo(
    () => ({
      browserFields: sourcererDataView.browserFields,
      closeFlyout,
      dataAsNestedObject,
      dataFormattedForFieldBrowser,
      expandableFlyoutConfig,
      getData,
      getFieldsData, // TODO: See if there is a way for us to type this properly rather than trying to type at time of use
      refetchFlyoutData,
      searchHit,
      updateExpandableFlyoutConfig,
    }),
    [
      closeFlyout,
      dataAsNestedObject,
      dataFormattedForFieldBrowser,
      expandableFlyoutConfig,
      getData,
      getFieldsData,
      refetchFlyoutData,
      searchHit,
      updateExpandableFlyoutConfig,
    ]
  );

  // TODO: rely on only one source of data
  const dataNotFound =
    !loading && (!dataFormattedForFieldBrowser || !searchHit || !dataAsNestedObject);

  if (dataNotFound) return <>{'Could not find data'}</>;

  return (
    <EventDetailsFlyoutContext.Provider value={contextValue}>
      {loading ? <>{'Loading...'}</> : children}
    </EventDetailsFlyoutContext.Provider>
  );
};

// If there is no data, then the nothing will load
export const useEventDetailsFlyoutContext = () =>
  useContext<NonNullable<EventDetailsFlyoutContextValues>>(EventDetailsFlyoutContext);
