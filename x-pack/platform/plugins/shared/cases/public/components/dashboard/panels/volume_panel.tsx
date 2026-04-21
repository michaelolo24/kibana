/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiHealth,
  EuiScreenReaderOnly,
  EuiSpacer,
  EuiText,
  useEuiTheme,
  useGeneratedHtmlId,
} from '@elastic/eui';
import type { AnalyticsVolumeBucket } from '../../../../common/types/api';
import * as i18n from '../translations';

interface VolumePanelProps {
  data: AnalyticsVolumeBucket[];
  dataTestSubj: string;
}

const CHART_HEIGHT = 200;
/** Minimum visible segment height so tiny non-zero values don't disappear. */
const MIN_VISIBLE_PX = 2;

export const VolumePanel: React.FC<VolumePanelProps> = React.memo(({ data, dataTestSubj }) => {
  const { euiTheme } = useEuiTheme();
  const tableId = useGeneratedHtmlId({ prefix: 'cases-dashboard-volume-table' });

  const max = useMemo(
    () => Math.max(...data.map((d) => d.opened + d.closed), 1),
    [data]
  );

  const totals = useMemo(
    () =>
      data.reduce(
        (acc, d) => ({ opened: acc.opened + d.opened, closed: acc.closed + d.closed }),
        { opened: 0, closed: 0 }
      ),
    [data]
  );

  return (
    <div data-test-subj={dataTestSubj}>
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiHealth color="primary">
            <EuiText size="xs">{i18n.VOLUME_OPENED_SERIES}</EuiText>
          </EuiHealth>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiHealth color="success">
            <EuiText size="xs">{i18n.VOLUME_CLOSED_SERIES}</EuiText>
          </EuiHealth>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
      <div
        css={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: euiTheme.size.xs,
          height: CHART_HEIGHT,
          borderBottom: `1px solid ${euiTheme.colors.lightShade}`,
          paddingBottom: euiTheme.size.xs,
        }}
        role="img"
        aria-labelledby={tableId}
      >
        {data.map((bucket) => {
          const openedPct = (bucket.opened / max) * 100;
          const closedPct = (bucket.closed / max) * 100;
          const dayLabel = formatDayLabel(bucket.date);
          return (
            <div
              key={bucket.date}
              css={{
                flex: 1,
                minWidth: 4,
                maxWidth: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                height: '100%',
              }}
              title={`${dayLabel}: ${bucket.opened} opened, ${bucket.closed} closed`}
              data-test-subj={`${dataTestSubj}-bucket-${bucket.date}`}
            >
              <div
                css={{
                  height: `max(${closedPct}%, ${bucket.closed > 0 ? MIN_VISIBLE_PX : 0}px)`,
                  backgroundColor: euiTheme.colors.success,
                  transition: 'height 150ms ease-out',
                }}
              />
              <div
                css={{
                  height: `max(${openedPct}%, ${bucket.opened > 0 ? MIN_VISIBLE_PX : 0}px)`,
                  backgroundColor: euiTheme.colors.primary,
                  transition: 'height 150ms ease-out',
                }}
              />
            </div>
          );
        })}
      </div>
      <EuiScreenReaderOnly>
        <table id={tableId}>
          <caption>
            {i18n.VOLUME_TITLE} — {data.length} days; {totals.opened} opened, {totals.closed}{' '}
            closed.
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">{i18n.VOLUME_OPENED_SERIES}</th>
              <th scope="col">{i18n.VOLUME_CLOSED_SERIES}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((bucket) => (
              <tr key={bucket.date}>
                <td>{formatDayLabel(bucket.date)}</td>
                <td>{bucket.opened}</td>
                <td>{bucket.closed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </EuiScreenReaderOnly>
    </div>
  );
});
VolumePanel.displayName = 'VolumePanel';

const formatDayLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
