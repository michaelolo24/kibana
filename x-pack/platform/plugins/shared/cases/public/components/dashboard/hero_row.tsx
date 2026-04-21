/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import { EuiFlexGrid, EuiFlexItem } from '@elastic/eui';
import type { AnalyticsDashboardResponse } from '../../../common/types/api';
import { CasesStatCard } from './cases_stat_card';
import { humanizeDuration } from './utils';
import * as i18n from './translations';

interface HeroRowProps {
  data: AnalyticsDashboardResponse | undefined;
  isLoading: boolean;
  onRetry: () => void;
  unassignedHref: string;
}

export const HeroRow: React.FC<HeroRowProps> = React.memo(
  ({ data, isLoading, onRetry, unassignedHref }) => {
    const mttrDisplay = useMemo(() => {
      const v = data?.mttrMs?.value;
      return v == null ? null : humanizeDuration(v);
    }, [data?.mttrMs?.value]);

    const closureDisplay = useMemo(() => {
      const v = data?.closureRate?.value;
      return v == null ? null : `${v}%`;
    }, [data?.closureRate?.value]);

    return (
      <EuiFlexGrid columns={4} responsive gutterSize="m" data-test-subj="cases-dashboard-hero">
        <EuiFlexItem>
          <CasesStatCard
            title={i18n.OPEN_CASES_TITLE}
            value={data?.openCases?.value ?? null}
            description={i18n.OPEN_CASES_DESCRIPTION}
            isLoading={isLoading}
            error={data?.openCases?.error ?? null}
            onRetry={onRetry}
            dataTestSubj="cases-dashboard-stat-openCases"
          />
        </EuiFlexItem>
        <EuiFlexItem>
          <CasesStatCard
            title={i18n.UNASSIGNED_TITLE}
            value={data?.unassigned?.value ?? null}
            description={i18n.UNASSIGNED_DESCRIPTION}
            isLoading={isLoading}
            error={data?.unassigned?.error ?? null}
            onRetry={onRetry}
            href={unassignedHref}
            dataTestSubj="cases-dashboard-stat-unassigned"
          />
        </EuiFlexItem>
        <EuiFlexItem>
          <CasesStatCard
            title={i18n.CLOSURE_RATE_TITLE}
            value={closureDisplay}
            description={i18n.WINDOW_DESCRIPTION}
            isLoading={isLoading}
            error={data?.closureRate?.error ?? null}
            onRetry={onRetry}
            tooltip={i18n.CLOSURE_RATE_TOOLTIP}
            dataTestSubj="cases-dashboard-stat-closureRate"
          />
        </EuiFlexItem>
        <EuiFlexItem>
          <CasesStatCard
            title={i18n.MTTR_TITLE}
            value={mttrDisplay}
            description={i18n.WINDOW_DESCRIPTION}
            isLoading={isLoading}
            error={data?.mttrMs?.error ?? null}
            onRetry={onRetry}
            tooltip={i18n.MTTR_TOOLTIP}
            dataTestSubj="cases-dashboard-stat-mttr"
          />
        </EuiFlexItem>
      </EuiFlexGrid>
    );
  }
);
HeroRow.displayName = 'HeroRow';
