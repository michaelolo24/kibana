/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyoutHeader,
  EuiSpacer,
  EuiTitle,
  EuiButton,
  EuiContextMenu,
  EuiPopover,
  EuiThemeComputed,
  useEuiTheme,
} from '@elastic/eui';
import React, { useMemo, useState } from 'react';
import { css } from '@emotion/react';
import { isEmpty } from 'lodash';
import copy from 'copy-to-clipboard';
import { useEventDetailsFlyoutContext } from '../../context';
import { useBasicDataFromDetailsData } from '../../helpers';
import { PreferenceFormattedDate } from '../../../../common/components/formatted_date';
import * as i18n from './translations';
import { EventVisualizePanelKey } from '../visualize';
import { EventTablePanelKey } from '../table';
const HeaderSummaryViewButton = ({ euiTheme }: { euiTheme: EuiThemeComputed }) => {
  const [isPopoverOpen, updateIsPopoverOpen] = useState(false);
  const { updateExpandableFlyoutConfig, expandableFlyoutConfig } = useEventDetailsFlyoutContext();
  const isShowingLeftSummary = !!expandableFlyoutConfig?.left.id;
  const closePopover = () => updateIsPopoverOpen(false);
  const openPopover = () => updateIsPopoverOpen(true);

  const panels = [
    {
      id: 0,
      title: 'Alert details',
      items: [
        {
          name: 'Visualize',
          onClick: () =>
            updateExpandableFlyoutConfig({
              left: { id: isShowingLeftSummary ? null : EventVisualizePanelKey },
            }),
        },
      ],
    },
  ];

  const button = useMemo(
    () => (
      <EuiButton color="text" iconType="eye" onClick={openPopover}>
        {i18n.EXPAND_DETAILS}
      </EuiButton>
    ),
    []
  );

  return (
    <div
      css={css`
        border-right: ${euiTheme.border.thin};
        padding-right: ${euiTheme.size.xs};
      `}
    >
      <EuiPopover
        anchorPosition="downCenter"
        button={button}
        closePopover={closePopover}
        isOpen={isPopoverOpen}
        panelPaddingSize="none"
      >
        <EuiContextMenu initialPanelId={0} panels={panels} />
      </EuiPopover>
    </div>
  );
};

const HeaderAlertNavigation = ({ euiTheme }: { euiTheme: EuiThemeComputed }) => (
  <div
    css={css`
      padding-left: ${euiTheme.size.xs};
    `}
  >
    <EuiButtonIcon color="text" iconType="arrowUp" />
    <EuiButtonIcon color="text" iconType="arrowDown" />
  </div>
);

const HeaderShareAlertButton = ({
  handleOnEventClosed,
  euiTheme,
}: {
  euiTheme: EuiThemeComputed;
  handleOnEventClosed?: () => void;
}) => {
  const copyHref = () => copy(window.location.href);
  const { closeFlyout } = useEventDetailsFlyoutContext();
  return (
    <div
      css={css`
        margin-left: auto;
        margin-right: ${euiTheme.size.xl};
      `}
    >
      <EuiButtonEmpty
        color="text"
        css={css`
          height: 0;
          padding: 0;
        `}
        onClick={copyHref}
        iconType="share"
      >
        {'Share alert'}
      </EuiButtonEmpty>
      {handleOnEventClosed && (
        <EuiButtonIcon iconType="cross" aria-label={i18n.CLOSE} onClick={closeFlyout} />
      )}
    </div>
  );
};

const HeaderTitleSection = () => {
  const { dataFormattedForFieldBrowser } = useEventDetailsFlyoutContext();
  const { isAlert, ruleName, timestamp } = useBasicDataFromDetailsData(
    dataFormattedForFieldBrowser
  );
  return (
    <EuiFlexGroup direction="column">
      <EuiTitle size="s">
        <h4>{isAlert && !isEmpty(ruleName) ? ruleName : i18n.EVENT_DETAILS}</h4>
      </EuiTitle>
      {timestamp && (
        <>
          <EuiSpacer size="s" />
          <PreferenceFormattedDate value={new Date(timestamp)} />
        </>
      )}
    </EuiFlexGroup>
  );
};

export const FlyoutHeader = React.memo(
  () => {
    const { euiTheme } = useEuiTheme();
    const { updateExpandableFlyoutConfig, expandableFlyoutConfig } = useEventDetailsFlyoutContext();
    return (
      <EuiFlyoutHeader
        css={css`
          padding: 0;
          padding-inline: 0 !important;
          padding-block-start: 0 !important;
        `}
      >
        <EuiFlexGroup
          css={css`
            justify-content: flex-start;
            flex: 0 1 auto;
            padding: ${euiTheme.size.s};
          `}
          direction="column"
          gutterSize="none"
          justifyContent="spaceBetween"
          wrap={true}
        >
          <EuiFlexItem>
            <EuiFlexGroup
              css={css`
                border-bottom: ${euiTheme.border.thin};
                gap: 0 !important;
                margin-bottom: ${euiTheme.size.l};
                padding-bottom: ${euiTheme.size.m};
              `}
              direction="row"
              alignItems="center"
            >
              <HeaderSummaryViewButton euiTheme={euiTheme} />
              <HeaderAlertNavigation euiTheme={euiTheme} />
              <HeaderShareAlertButton euiTheme={euiTheme} />
            </EuiFlexGroup>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiFlexGroup direction="row">
              <HeaderTitleSection />
              <EuiButtonIcon iconType="tableDensityExpanded" onClick={() => {
                updateExpandableFlyoutConfig({
                  right: { id: EventTablePanelKey }
                })
              }} />
            </EuiFlexGroup>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutHeader>
    );
  }
);

FlyoutHeader.displayName = 'FlyoutHeader';
