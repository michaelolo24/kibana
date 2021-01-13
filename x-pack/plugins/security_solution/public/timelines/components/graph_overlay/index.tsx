/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import {
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiPanel,
} from '@elastic/eui';
import React, { useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import { DEFAULT_INDEX_KEY } from '../../../../common/constants';
import {
  useGlobalFullScreen,
  useTimelineFullScreen,
} from '../../../common/containers/use_full_screen';
import { useDeepEqualSelector } from '../../../common/hooks/use_selector';
import { TimelineId } from '../../../../common/types/timeline';
import { timelineSelectors } from '../../store/timeline';
import { timelineDefaults } from '../../store/timeline/defaults';
import { isFullScreen } from '../timeline/body/column_headers';
import { updateTimelineGraphEventId } from '../../../timelines/store/timeline/actions';
import { Resolver } from '../../../resolver/view';
import {
  isLoadingSelector,
  startSelector,
  endSelector,
} from '../../../common/components/super_date_picker/selectors';
import * as i18n from './translations';
import { useUiSetting$ } from '../../../common/lib/kibana';
import { useSignalIndex } from '../../../detections/containers/detection_engine/alerts/use_signal_index';

const OverlayContainer = styled.div<{ $restrictWidth: boolean }>`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: ${({ $restrictWidth }) => ($restrictWidth ? 'calc(100% - 36px)' : '100%')};
`;

/** TODO: MOO - Consolidate the below styles across all the tab files */
const FullWidthFlexGroup = styled(EuiFlexGroup)`
  height: 100%;
  width: 100%;
  margin: 0;
  overflow: hidden;
`;

const ScrollableFlexItem = styled(EuiFlexItem)`
  overflow-x: hidden;
  overflow-y: none;
`;

const VerticalRule = styled.div`
  width: 2px;
  height: 100%;
  background: ${({ theme }) => theme.eui.euiColorLightShade};
`;

const StyledResolverPanel = styled(EuiPanel)`
  height: 100%;
  padding: 0;
`;

const StyledResolver = styled(Resolver)`
  height: 100%;
`;

interface OwnProps {
  wasAlreadyFullScreen: boolean;
  isEventViewer: boolean;
  timelineId: string;
}

interface NavigationProps {
  onCloseOverlay: () => void;
}

const NavigationComponent: React.FC<NavigationProps> = ({ onCloseOverlay }) => (
  <EuiFlexGroup alignItems="center" gutterSize="none">
    <EuiFlexItem grow={false}>
      <EuiButtonEmpty iconType="cross" onClick={onCloseOverlay} size="xs">
        {i18n.CLOSE_ANALYZER}
      </EuiButtonEmpty>
    </EuiFlexItem>
  </EuiFlexGroup>
);

NavigationComponent.displayName = 'NavigationComponent';

const Navigation = React.memo(NavigationComponent);

const GraphOverlayComponent: React.FC<OwnProps> = ({
  wasAlreadyFullScreen,
  isEventViewer,
  timelineId,
}) => {
  const dispatch = useDispatch();
  const { globalFullScreen, setGlobalFullScreen } = useGlobalFullScreen();
  const { timelineFullScreen, setTimelineFullScreen } = useTimelineFullScreen();

  // This graph component will always open in full screen, so only necessary to close it
  const closeFullScreen = useCallback(() => {
    if (timelineId === TimelineId.active) {
      setTimelineFullScreen(false);
    } else {
      setGlobalFullScreen(false);
    }
  }, [timelineId, setTimelineFullScreen, setGlobalFullScreen]);

  const onCloseOverlay = useCallback(() => {
    if (!wasAlreadyFullScreen) closeFullScreen();
    dispatch(updateTimelineGraphEventId({ id: timelineId, graphEventId: '' }));
  }, [wasAlreadyFullScreen, closeFullScreen, dispatch, timelineId]);

  const getTimeline = useMemo(() => timelineSelectors.getTimelineByIdSelector(), []);
  const graphEventId = useDeepEqualSelector(
    (state) => (getTimeline(state, timelineId) ?? timelineDefaults).graphEventId
  );

  // eslint-disable-next-line react/display-name
  const EventDetailsContent = React.memo(() =>
    graphEventId != null ? <div>{'Replacement Panel Goes Here'}</div> : null
  );

  const getTimerangeStartSelector = useMemo(() => startSelector(), []);
  const getTimerangeEndSelector = useMemo(() => endSelector(), []);
  const getIsLoadingSelector = useMemo(() => isLoadingSelector(), []);
  const isTimelineFlyoutActive = useMemo(() => timelineId === TimelineId.active, [timelineId]);

  const timelineInputFilters = useDeepEqualSelector((state) => {
    let shouldUpdate;
    let from;
    let to;
    if (isTimelineFlyoutActive) {
      shouldUpdate = getIsLoadingSelector(state.inputs.timeline);
      from = getTimerangeStartSelector(state.inputs.timeline);
      to = getTimerangeEndSelector(state.inputs.timeline);
    } else {
      shouldUpdate = getIsLoadingSelector(state.inputs.global);
      from = getTimerangeStartSelector(state.inputs.global);
      to = getTimerangeEndSelector(state.inputs.global);
    }
    return { shouldUpdate, from, to };
  });

  const memoizedIsFullScreen = useMemo(
    () => isFullScreen({ globalFullScreen, timelineId, timelineFullScreen }),
    [globalFullScreen, timelineId, timelineFullScreen]
  );

  const { signalIndexName } = useSignalIndex();
  const [siemDefaultIndices] = useUiSetting$<string[]>(DEFAULT_INDEX_KEY);
  const indices: string[] | null = useMemo(() => {
    if (signalIndexName === null) {
      return null;
    } else {
      return [...siemDefaultIndices, signalIndexName];
    }
  }, [signalIndexName, siemDefaultIndices]);

  return (
    <OverlayContainer
      data-test-subj="overlayContainer"
      $restrictWidth={isEventViewer && memoizedIsFullScreen}
    >
      {/* <EuiHorizontalRule margin="none" /> */}
      {memoizedIsFullScreen && !isTimelineFlyoutActive && (
        <EuiFlexGroup gutterSize="none" justifyContent="spaceBetween">
          <EuiFlexItem grow={false}>
            <Navigation onCloseOverlay={onCloseOverlay} />
          </EuiFlexItem>
        </EuiFlexGroup>
      )}
      <StyledResolverPanel>
        <FullWidthFlexGroup>
          <ScrollableFlexItem grow={3}>
            {graphEventId !== undefined && indices !== null ? (
              <StyledResolver
                databaseDocumentID={graphEventId}
                resolverComponentInstanceID={timelineId}
                indices={indices}
                shouldUpdate={timelineInputFilters.shouldUpdate}
                filters={{ from: timelineInputFilters.from, to: timelineInputFilters.to }}
              />
            ) : (
              <EuiFlexGroup alignItems="center" justifyContent="center" style={{ height: '100%' }}>
                <EuiLoadingSpinner size="xl" />
              </EuiFlexGroup>
            )}
          </ScrollableFlexItem>
          {EventDetailsContent && (
            <>
              <VerticalRule />
              <ScrollableFlexItem grow={1}>
                <EventDetailsContent />
              </ScrollableFlexItem>
            </>
          )}
        </FullWidthFlexGroup>
      </StyledResolverPanel>
    </OverlayContainer>
  );
};

export const GraphOverlay = React.memo(GraphOverlayComponent);
