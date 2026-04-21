/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';

export const DASHBOARD_TAB_LABEL = i18n.translate('xpack.cases.home.dashboardTabLabel', {
  defaultMessage: 'Dashboard',
});

export const CASES_TAB_LABEL = i18n.translate('xpack.cases.home.casesTabLabel', {
  defaultMessage: 'Cases',
});

export const OPEN_CASES_TITLE = i18n.translate('xpack.cases.dashboard.openCases.title', {
  defaultMessage: 'Open cases',
});

export const OPEN_CASES_DESCRIPTION = i18n.translate(
  'xpack.cases.dashboard.openCases.description',
  { defaultMessage: 'currently' }
);

export const UNASSIGNED_TITLE = i18n.translate('xpack.cases.dashboard.unassigned.title', {
  defaultMessage: 'Unassigned',
});

export const UNASSIGNED_DESCRIPTION = i18n.translate(
  'xpack.cases.dashboard.unassigned.description',
  { defaultMessage: 'click to view' }
);

export const CLOSURE_RATE_TITLE = i18n.translate('xpack.cases.dashboard.closureRate.title', {
  defaultMessage: 'Closure rate',
});

export const CLOSURE_RATE_TOOLTIP = i18n.translate('xpack.cases.dashboard.closureRate.tooltip', {
  defaultMessage:
    'Percentage of cases closed out of cases opened + closed during the selected window.',
});

export const MTTR_TITLE = i18n.translate('xpack.cases.dashboard.mttr.title', {
  defaultMessage: 'MTTR',
});

export const MTTR_TOOLTIP = i18n.translate('xpack.cases.dashboard.mttr.tooltip', {
  defaultMessage:
    'Mean Time To Resolve — average time from case creation to closure for cases closed in the selected window.',
});

export const WINDOW_DESCRIPTION = i18n.translate('xpack.cases.dashboard.window.description', {
  defaultMessage: 'selected window',
});

export const VOLUME_TITLE = i18n.translate('xpack.cases.dashboard.volume.title', {
  defaultMessage: 'Case volume over time',
});

export const VOLUME_OPENED_SERIES = i18n.translate('xpack.cases.dashboard.volume.openedSeries', {
  defaultMessage: 'Opened',
});

export const VOLUME_CLOSED_SERIES = i18n.translate('xpack.cases.dashboard.volume.closedSeries', {
  defaultMessage: 'Closed',
});

export const TOP_ASSIGNEES_TITLE = i18n.translate('xpack.cases.dashboard.topAssignees.title', {
  defaultMessage: 'Top assignees',
});

export const TOP_ASSIGNEES_SUBTITLE = i18n.translate(
  'xpack.cases.dashboard.topAssignees.subtitle',
  { defaultMessage: 'by open case count' }
);

export const STATUS_DISTRIBUTION_TITLE = i18n.translate(
  'xpack.cases.dashboard.statusDistribution.title',
  { defaultMessage: 'Status distribution' }
);

export const SEVERITY_DISTRIBUTION_TITLE = i18n.translate(
  'xpack.cases.dashboard.severityDistribution.title',
  { defaultMessage: 'Severity distribution' }
);

export const STATUS_OPEN = i18n.translate('xpack.cases.dashboard.status.open', {
  defaultMessage: 'Open',
});
export const STATUS_IN_PROGRESS = i18n.translate('xpack.cases.dashboard.status.inProgress', {
  defaultMessage: 'In progress',
});
export const STATUS_CLOSED = i18n.translate('xpack.cases.dashboard.status.closed', {
  defaultMessage: 'Closed',
});

export const SEVERITY_CRITICAL = i18n.translate('xpack.cases.dashboard.severity.critical', {
  defaultMessage: 'Critical',
});
export const SEVERITY_HIGH = i18n.translate('xpack.cases.dashboard.severity.high', {
  defaultMessage: 'High',
});
export const SEVERITY_MEDIUM = i18n.translate('xpack.cases.dashboard.severity.medium', {
  defaultMessage: 'Medium',
});
export const SEVERITY_LOW = i18n.translate('xpack.cases.dashboard.severity.low', {
  defaultMessage: 'Low',
});

export const CARD_ERROR_TITLE = i18n.translate('xpack.cases.dashboard.cardError.title', {
  defaultMessage: "Couldn't load this metric",
});

export const CARD_ERROR_RETRY = i18n.translate('xpack.cases.dashboard.cardError.retry', {
  defaultMessage: 'Retry',
});

export const PAGE_ERROR_TITLE = i18n.translate('xpack.cases.dashboard.pageError.title', {
  defaultMessage: 'Unable to load the dashboard',
});

export const PAGE_ERROR_TRY_AGAIN = i18n.translate('xpack.cases.dashboard.pageError.tryAgain', {
  defaultMessage: 'Try again',
});

export const EMPTY_STATE_TITLE = i18n.translate('xpack.cases.dashboard.emptyState.title', {
  defaultMessage: 'No data to display yet',
});

export const EMPTY_STATE_BODY = i18n.translate('xpack.cases.dashboard.emptyState.body', {
  defaultMessage: 'Once cases exist in this space, metrics will appear here.',
});

export const REFRESH_ARIA = i18n.translate('xpack.cases.dashboard.refreshAria', {
  defaultMessage: 'Refresh dashboard',
});

export const NO_DATA = i18n.translate('xpack.cases.dashboard.noData', {
  defaultMessage: 'No data',
});

export const INVALID_TIME_RANGE_TITLE = i18n.translate(
  'xpack.cases.dashboard.invalidTimeRange.title',
  { defaultMessage: "Couldn't parse the selected time range" }
);

export const INVALID_TIME_RANGE_BODY = i18n.translate(
  'xpack.cases.dashboard.invalidTimeRange.body',
  { defaultMessage: 'Please pick a different range from the picker above.' }
);
