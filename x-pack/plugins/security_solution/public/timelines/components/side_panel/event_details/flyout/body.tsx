/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiButtonEmpty, EuiCallOut, EuiFlyoutBody } from '@elastic/eui';
import moment from 'moment';
import styled from 'styled-components';
import React, { useCallback, useMemo } from 'react';
import type { EcsSecurityExtension as Ecs } from '@kbn/securitysolution-ecs';
import { useDispatch } from 'react-redux';
import { setAbsoluteRangeDatePicker } from '../../../../../common/store/inputs/actions';
import { InputsModelId } from '../../../../../common/store/inputs/constants';
import { useGlobalTime } from '../../../../../common/containers/use_global_time';
import { EndpointIsolateSuccess } from '../../../../../common/components/endpoint/host_isolation';
import { HostIsolationPanel } from '../../../../../detections/components/host_isolation';
import type {
  BrowserFields,
  TimelineEventsDetailsItem,
} from '../../../../../../common/search_strategy';
import type { HandleOnEventClosed } from '../expandable_event';
import { ExpandableEvent } from '../expandable_event';

interface FlyoutBannerProps {
  text: string;
  actionText?: string;
  onClick?: () => void;
}

const getFlyoutBanner = ({ text, actionText, onClick }: FlyoutBannerProps) => (
  <EuiCallOut iconType="help">
    <p>
      {text}
      {onClick && actionText && <EuiButtonEmpty onClick={onClick}>{actionText}</EuiButtonEmpty>}
    </p>
  </EuiCallOut>
);

const StyledEuiFlyoutBody = styled(EuiFlyoutBody)`
  .euiFlyoutBody__overflow {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;

    .euiFlyoutBody__overflowContent {
      flex: 1;
      overflow: hidden;
      padding: ${({ theme }) => `0 ${theme.eui.euiSizeM} ${theme.eui.euiSizeM}`};
    }
  }
`;

interface FlyoutBodyComponentProps {
  alertId: string;
  browserFields: BrowserFields;
  detailsData: TimelineEventsDetailsItem[] | null;
  detailsEcsData: Ecs | null;
  event: { eventId: string; indexName: string };
  handleIsolationActionSuccess: () => void;
  handleOnEventClosed: HandleOnEventClosed;
  hostName: string;
  isAlert: boolean;
  isDraggable?: boolean;
  isReadOnly?: boolean;
  isolateAction: 'isolateHost' | 'unisolateHost';
  isIsolateActionSuccessBannerVisible: boolean;
  isHostIsolationPanelOpen: boolean;
  loading: boolean;
  rawEventData: object | undefined;
  showAlertDetails: () => void;
  scopeId: string;
  timestamp: string;
}

const FlyoutBodyComponent = ({
  alertId,
  browserFields,
  detailsData,
  detailsEcsData,
  event,
  handleIsolationActionSuccess,
  handleOnEventClosed,
  hostName,
  isAlert,
  isDraggable,
  isReadOnly,
  isolateAction,
  isHostIsolationPanelOpen,
  isIsolateActionSuccessBannerVisible,
  loading,
  rawEventData,
  showAlertDetails,
  scopeId,
  timestamp,
}: FlyoutBodyComponentProps) => {
  const { from, to } = useGlobalTime();
  const fromTime = moment(from).valueOf();
  const toTime = moment(to).valueOf();
  const alertTime = moment(timestamp).valueOf();

  const alertIsNotInRange = useMemo(() => {
    if (alertTime > toTime || alertTime < fromTime) {
      return true;
    }
    return false;
  }, [alertTime, fromTime, toTime]);

  console.log('******TIMES: ', fromTime, toTime, alertTime, alertIsNotInRange);
  const dispatch = useDispatch();
  const updateTimeRange = useCallback(() => {
    if (!alertTime) {
      return;
    }
    dispatch(
      setAbsoluteRangeDatePicker({
        id: InputsModelId.global,
        from: new Date(alertTime).toISOString(),
        to: new Date(alertTime + 1000).toISOString(),
      })
    );
  }, [alertTime, dispatch]);

  return (
    <StyledEuiFlyoutBody
      banner={
        alertIsNotInRange
          ? getFlyoutBanner({
              text: 'Please update the time range',
              actionText: 'Update Time',
              onClick: updateTimeRange,
            })
          : null
      }
    >
      {isIsolateActionSuccessBannerVisible && (
        <EndpointIsolateSuccess
          hostName={hostName}
          alertId={alertId}
          isolateAction={isolateAction}
        />
      )}
      {isHostIsolationPanelOpen ? (
        <HostIsolationPanel
          details={detailsData}
          cancelCallback={showAlertDetails}
          successCallback={handleIsolationActionSuccess}
          isolateAction={isolateAction}
        />
      ) : (
        <ExpandableEvent
          browserFields={browserFields}
          detailsData={detailsData}
          detailsEcsData={detailsEcsData}
          event={event}
          isAlert={isAlert}
          isDraggable={isDraggable}
          loading={loading}
          rawEventData={rawEventData}
          scopeId={scopeId}
          timelineTabType="flyout"
          handleOnEventClosed={handleOnEventClosed}
          isReadOnly={isReadOnly}
        />
      )}
    </StyledEuiFlyoutBody>
  );
};

const FlyoutBody = React.memo(FlyoutBodyComponent);

export { FlyoutBody };
