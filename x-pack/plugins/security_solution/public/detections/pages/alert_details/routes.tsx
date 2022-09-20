/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { Switch, Redirect, useParams } from 'react-router-dom';
import { Route } from '@kbn/kibana-react-plugin/public';
import { EuiSpacer } from '@elastic/eui';
import { useSourcererDataView } from '../../../common/containers/sourcerer';
import { AlertSummary } from './pages/summary';
import {
  ALERT_DETAILS_NO_TAB_PATH,
  ALERT_DETAILS_SUMMARY_PATH,
  ALERT_DETAILS_VISUALIZE_PATH,
} from './constants';
import { getAlertDetailsNavTabs, getAlertDetailsTabUrl } from './constants/navigation';
import { AlertDetailRouteType } from './types';
import { SecuritySolutionTabNavigation } from '../../../common/components/navigation';
import { AlertDetailHeader } from './components/alert_header';
import { useSpaceId } from '../../../common/hooks/use_space_id';
import { SourcererScopeName } from '../../../common/store/sourcerer/model';
import { useBasicDataFromDetailsData } from '../../../timelines/components/side_panel/event_details/helpers';
import { useTimelineEventsDetails } from '../../../timelines/containers/details';
import { AlertVisualize } from './pages/visualize';

export const AlertDetailsRoutes = () => {
  const { detailName: eventId } = useParams<{ detailName: string }>();
  const spaceId = useSpaceId();
  const { runtimeMappings, selectedPatterns } = useSourcererDataView(SourcererScopeName.detections);

  const [loading, detailsData, rawEventData, ecsData, refetchFlyoutData] = useTimelineEventsDetails(
    {
      indexName: `.alerts-security.alerts-${spaceId}`,
      eventId: eventId ?? '',
      runtimeMappings,
      skip: !eventId,
    }
  );

  const { alertId, ruleName, status, timestamp } = useBasicDataFromDetailsData(detailsData);

  return (
    <>
      <AlertDetailHeader
        detailsData={detailsData}
        id={alertId}
        ecsData={ecsData}
        isLoading={loading}
        refetch={refetchFlyoutData}
        status={status}
        ruleName={ruleName}
        timestamp={timestamp}
      />
      <EuiSpacer />
      <SecuritySolutionTabNavigation navTabs={getAlertDetailsNavTabs(alertId)} />
      <Switch>
        <Route
          exact
          strict
          path={ALERT_DETAILS_NO_TAB_PATH}
          render={({ location: { search = '' }, match: { params } }) => (
            <Redirect
              to={{
                pathname: getAlertDetailsTabUrl(params.detailName, AlertDetailRouteType.summary),
                search,
              }}
            />
          )}
        />
        <Route exact path={ALERT_DETAILS_SUMMARY_PATH}>
          <AlertSummary data={detailsData} id={alertId} ecsData={ecsData} event={rawEventData} />
        </Route>
        <Route exact path={ALERT_DETAILS_VISUALIZE_PATH}>
          <AlertVisualize data={detailsData} id={alertId} ecsData={ecsData} event={rawEventData} />
        </Route>
      </Switch>
    </>
  );
};
