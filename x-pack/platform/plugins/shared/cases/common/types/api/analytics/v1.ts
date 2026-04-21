/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as rt from 'io-ts';

export const AnalyticsDashboardRequestRt = rt.strict({
  from: rt.string,
  to: rt.string,
});

const ScalarCardRt = rt.strict({
  value: rt.union([rt.number, rt.null]),
  error: rt.union([rt.string, rt.null]),
});

const VolumeBucketRt = rt.strict({
  date: rt.string,
  opened: rt.number,
  closed: rt.number,
});

const VolumeCardRt = rt.strict({
  data: rt.union([rt.array(VolumeBucketRt), rt.null]),
  error: rt.union([rt.string, rt.null]),
});

const AssigneeBucketRt = rt.strict({
  assignee: rt.string,
  count: rt.number,
});

const TopAssigneesCardRt = rt.strict({
  data: rt.union([rt.array(AssigneeBucketRt), rt.null]),
  error: rt.union([rt.string, rt.null]),
});

const StatusDistributionDataRt = rt.strict({
  open: rt.number,
  inProgress: rt.number,
  closed: rt.number,
});

const StatusDistributionCardRt = rt.strict({
  data: rt.union([StatusDistributionDataRt, rt.null]),
  error: rt.union([rt.string, rt.null]),
});

const SeverityDistributionDataRt = rt.strict({
  critical: rt.number,
  high: rt.number,
  medium: rt.number,
  low: rt.number,
});

const SeverityDistributionCardRt = rt.strict({
  data: rt.union([SeverityDistributionDataRt, rt.null]),
  error: rt.union([rt.string, rt.null]),
});

export const AnalyticsDashboardResponseRt = rt.strict({
  openCases: ScalarCardRt,
  unassigned: ScalarCardRt,
  closureRate: ScalarCardRt,
  mttrMs: ScalarCardRt,
  volume: VolumeCardRt,
  topAssignees: TopAssigneesCardRt,
  statusDistribution: StatusDistributionCardRt,
  severityDistribution: SeverityDistributionCardRt,
});

export type AnalyticsDashboardRequest = rt.TypeOf<typeof AnalyticsDashboardRequestRt>;
export type AnalyticsDashboardResponse = rt.TypeOf<typeof AnalyticsDashboardResponseRt>;
export type AnalyticsScalarCard = rt.TypeOf<typeof ScalarCardRt>;
export type AnalyticsVolumeBucket = rt.TypeOf<typeof VolumeBucketRt>;
export type AnalyticsAssigneeBucket = rt.TypeOf<typeof AssigneeBucketRt>;
export type AnalyticsStatusDistribution = rt.TypeOf<typeof StatusDistributionDataRt>;
export type AnalyticsSeverityDistribution = rt.TypeOf<typeof SeverityDistributionDataRt>;
