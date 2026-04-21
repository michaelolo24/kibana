/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  EuiButtonIcon,
  EuiCallOut,
  EuiEmptyPrompt,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiSuperDatePicker,
} from '@elastic/eui';
import datemath from '@kbn/datemath';
import type { AnalyticsDashboardResponse } from '../../../common/types/api';
import { useGetAnalyticsDashboard } from '../../containers/analytics/use_get_analytics_dashboard';
import { HeroRow } from './hero_row';
import { PanelWrapper } from './panels/panel_wrapper';
import { HorizontalBarsPanel } from './panels/horizontal_bars_panel';
import { LensVolumePanel } from './lens/lens_volume_panel';
import * as i18n from './translations';

const DEFAULT_FROM = 'now-30d';
const DEFAULT_TO = 'now';

interface TimeRangeState {
  from: string;
  to: string;
  refreshToken: number;
}

const toIso = (expr: string, roundUp: boolean): string | null => {
  const d = datemath.parse(expr, { roundUp });
  if (!d || !d.isValid()) return null;
  return d.toISOString();
};

interface CasesDashboardProps {
  /**
   * Absolute path (including query params) for the "Cases" tab filtered to unassigned + open.
   * The parent owns the navigation path so this component stays solution-agnostic.
   */
  unassignedHref: string;
}

export const CasesDashboard: React.FC<CasesDashboardProps> = React.memo(({ unassignedHref }) => {
  const [range, setRange] = useState<TimeRangeState>({
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    refreshToken: 0,
  });

  const resolved = useMemo(() => {
    const from = toIso(range.from, false);
    const to = toIso(range.to, true);
    return from && to ? { from, to } : null;
  }, [range.from, range.to]);

  const { data, isLoading, isError, refetch } = useGetAnalyticsDashboard({
    from: resolved?.from ?? '',
    to: resolved?.to ?? '',
    enabled: resolved !== null,
  });

  const onTimeChange = useCallback(({ start, end }: { start: string; end: string }) => {
    setRange((prev) => ({ ...prev, from: start, to: end }));
  }, []);

  const onRefresh = useCallback(() => {
    setRange((prev) => ({ ...prev, refreshToken: prev.refreshToken + 1 }));
    refetch();
  }, [refetch]);

  if (isError && !data) {
    return (
      <EuiEmptyPrompt
        color="danger"
        iconType="alert"
        title={<h2>{i18n.PAGE_ERROR_TITLE}</h2>}
        actions={
          <EuiButtonIcon
            iconType="refresh"
            aria-label={i18n.PAGE_ERROR_TRY_AGAIN}
            onClick={onRefresh}
            display="fill"
            data-test-subj="cases-dashboard-page-retry"
          />
        }
        data-test-subj="cases-dashboard-page-error"
      />
    );
  }

  const allCardsSucceeded =
    data !== undefined &&
    data.openCases.error === null &&
    data.unassigned.error === null &&
    data.closureRate.error === null &&
    data.mttrMs.error === null &&
    data.volume.error === null &&
    data.topAssignees.error === null &&
    data.statusDistribution.error === null &&
    data.severityDistribution.error === null;

  const isFirstTimeEmpty =
    !isLoading &&
    allCardsSucceeded &&
    data.openCases.value === 0 &&
    data.statusDistribution.data?.open === 0 &&
    data.statusDistribution.data?.inProgress === 0 &&
    data.statusDistribution.data?.closed === 0 &&
    data.volume.data?.length === 0;

  return (
    <div data-test-subj="cases-dashboard">
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiSuperDatePicker
            start={range.from}
            end={range.to}
            onTimeChange={onTimeChange}
            showUpdateButton="iconOnly"
            width="auto"
            commonlyUsedRanges={[
              { start: 'now/d', end: 'now/d', label: 'Today' },
              { start: 'now-24h', end: 'now', label: 'Last 24 hours' },
              { start: 'now-7d', end: 'now', label: 'Last 7 days' },
              { start: 'now-30d', end: 'now', label: 'Last 30 days' },
              { start: 'now-90d', end: 'now', label: 'Last 90 days' },
            ]}
            data-test-subj="cases-dashboard-time-range"
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonIcon
            iconType="refresh"
            aria-label={i18n.REFRESH_ARIA}
            onClick={onRefresh}
            isDisabled={isLoading}
            data-test-subj="cases-dashboard-refresh"
          />
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      {resolved === null ? (
        <EuiCallOut
          size="s"
          color="warning"
          title={i18n.INVALID_TIME_RANGE_TITLE}
          data-test-subj="cases-dashboard-invalid-range"
        >
          <p>{i18n.INVALID_TIME_RANGE_BODY}</p>
        </EuiCallOut>
      ) : isFirstTimeEmpty ? (
        <EuiEmptyPrompt
          iconType="dashboardApp"
          title={<h2>{i18n.EMPTY_STATE_TITLE}</h2>}
          body={<p>{i18n.EMPTY_STATE_BODY}</p>}
          data-test-subj="cases-dashboard-empty"
        />
      ) : (
        <DashboardBody
          data={data}
          isLoading={isLoading}
          onRetry={onRefresh}
          unassignedHref={unassignedHref}
          timeRange={resolved ?? { from: range.from, to: range.to }}
        />
      )}
    </div>
  );
});
CasesDashboard.displayName = 'CasesDashboard';

interface DashboardBodyProps {
  data: AnalyticsDashboardResponse | undefined;
  isLoading: boolean;
  onRetry: () => void;
  unassignedHref: string;
  timeRange: { from: string; to: string };
}

const DashboardBody: React.FC<DashboardBodyProps> = ({
  data,
  isLoading,
  onRetry,
  unassignedHref,
  timeRange,
}) => {
  const topAssigneesRows = useMemo(
    () =>
      (data?.topAssignees.data ?? []).map((entry) => ({
        key: entry.assignee,
        label: entry.assignee,
        count: entry.count,
        color: 'primary' as const,
      })),
    [data?.topAssignees.data]
  );

  const statusRows = useMemo(() => {
    const d = data?.statusDistribution.data;
    if (!d) return [];
    return [
      { key: 'open', label: i18n.STATUS_OPEN, count: d.open, color: 'primary' as const },
      {
        key: 'in-progress',
        label: i18n.STATUS_IN_PROGRESS,
        count: d.inProgress,
        color: 'warning' as const,
      },
      { key: 'closed', label: i18n.STATUS_CLOSED, count: d.closed, color: 'subdued' as const },
    ];
  }, [data?.statusDistribution.data]);

  const severityRows = useMemo(() => {
    const d = data?.severityDistribution.data;
    if (!d) return [];
    return [
      {
        key: 'critical',
        label: i18n.SEVERITY_CRITICAL,
        count: d.critical,
        color: 'danger' as const,
      },
      { key: 'high', label: i18n.SEVERITY_HIGH, count: d.high, color: 'warning' as const },
      {
        key: 'medium',
        label: i18n.SEVERITY_MEDIUM,
        count: d.medium,
        color: 'primary' as const,
      },
      { key: 'low', label: i18n.SEVERITY_LOW, count: d.low, color: 'subdued' as const },
    ];
  }, [data?.severityDistribution.data]);

  return (
    <>
      <HeroRow
        data={data}
        isLoading={isLoading}
        onRetry={onRetry}
        unassignedHref={unassignedHref}
      />
      <EuiSpacer size="l" />
      <EuiFlexGroup gutterSize="l">
        <EuiFlexItem>
          <LensVolumePanel timeRange={timeRange} />
        </EuiFlexItem>
        <EuiFlexItem>
          <PanelWrapper
            title={i18n.TOP_ASSIGNEES_TITLE}
            subtitle={i18n.TOP_ASSIGNEES_SUBTITLE}
            isLoading={isLoading}
            error={data?.topAssignees.error ?? null}
            onRetry={onRetry}
            isEmpty={!isLoading && topAssigneesRows.length === 0}
            dataTestSubj="cases-dashboard-topAssignees"
          >
            <HorizontalBarsPanel
              rows={topAssigneesRows}
              dataTestSubj="cases-dashboard-topAssignees-bars"
            />
          </PanelWrapper>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="l" />
      <EuiFlexGroup gutterSize="l">
        <EuiFlexItem>
          <PanelWrapper
            title={i18n.STATUS_DISTRIBUTION_TITLE}
            isLoading={isLoading}
            error={data?.statusDistribution.error ?? null}
            onRetry={onRetry}
            isEmpty={!isLoading && statusRows.every((r) => r.count === 0)}
            dataTestSubj="cases-dashboard-status"
          >
            <HorizontalBarsPanel
              rows={statusRows}
              dataTestSubj="cases-dashboard-status-bars"
            />
          </PanelWrapper>
        </EuiFlexItem>
        <EuiFlexItem>
          <PanelWrapper
            title={i18n.SEVERITY_DISTRIBUTION_TITLE}
            isLoading={isLoading}
            error={data?.severityDistribution.error ?? null}
            onRetry={onRetry}
            isEmpty={!isLoading && severityRows.every((r) => r.count === 0)}
            dataTestSubj="cases-dashboard-severity"
          >
            <HorizontalBarsPanel
              rows={severityRows}
              dataTestSubj="cases-dashboard-severity-bars"
            />
          </PanelWrapper>
        </EuiFlexItem>
      </EuiFlexGroup>
    </>
  );
};
