/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo } from 'react';
import { EuiTabs, EuiTab, EuiSpacer } from '@elastic/eui';
import { useHistory, useLocation } from 'react-router-dom';
import { useCasesFeatures } from '../../common/use_cases_features';
import { useCasesContext } from '../cases_context/use_cases_context';
import { AllCases } from './index';
import { AllCasesList } from './all_cases_list';
import { CasesPageShell } from './cases_page_shell';
import { CasesDashboard } from '../dashboard/cases_dashboard';
import * as dashboardI18n from '../dashboard/translations';

type TabId = 'cases' | 'dashboard';
const TAB_QUERY_PARAM = 'tab';
const DASHBOARD_TAB: TabId = 'dashboard';
const CASES_TAB: TabId = 'cases';

const parseTabParam = (search: string): TabId => {
  const params = new URLSearchParams(search);
  return params.get(TAB_QUERY_PARAM) === DASHBOARD_TAB ? DASHBOARD_TAB : CASES_TAB;
};

/**
 * Home-page wrapper that introduces a tab strip ("Cases" / "Dashboard") for solutions that
 * have opted in via `features.analyticsDashboard.enabled`. When the flag is off this component
 * renders the existing `<AllCases />` with no visual or DOM change.
 */
export const CasesHomeTabs: React.FC = React.memo(() => {
  const { isAnalyticsDashboardEnabled } = useCasesFeatures();

  if (!isAnalyticsDashboardEnabled) {
    return <AllCases />;
  }

  return <CasesHomeTabsEnabled />;
});
CasesHomeTabs.displayName = 'CasesHomeTabs';

const CasesHomeTabsEnabled: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const { basePath } = useCasesContext();

  const activeTab = useMemo<TabId>(() => parseTabParam(location.search), [location.search]);

  const onSelectTab = useCallback(
    (id: TabId) => {
      const params = new URLSearchParams(location.search);
      if (id === CASES_TAB) params.delete(TAB_QUERY_PARAM);
      else params.set(TAB_QUERY_PARAM, id);
      const search = params.toString();
      history.push({ pathname: location.pathname, search });
    },
    [history, location.pathname, location.search]
  );

  const unassignedHref = useMemo(() => basePath, [basePath]);

  return (
    <CasesPageShell>
      <EuiTabs size="l" data-test-subj="cases-home-tabs">
        <EuiTab
          isSelected={activeTab === CASES_TAB}
          onClick={() => onSelectTab(CASES_TAB)}
          data-test-subj="cases-home-tab-cases"
        >
          {dashboardI18n.CASES_TAB_LABEL}
        </EuiTab>
        <EuiTab
          isSelected={activeTab === DASHBOARD_TAB}
          onClick={() => onSelectTab(DASHBOARD_TAB)}
          data-test-subj="cases-home-tab-dashboard"
        >
          {dashboardI18n.DASHBOARD_TAB_LABEL}
        </EuiTab>
      </EuiTabs>
      <EuiSpacer size="l" />
      {activeTab === DASHBOARD_TAB ? (
        <CasesDashboard unassignedHref={unassignedHref} />
      ) : (
        <AllCasesList />
      )}
    </CasesPageShell>
  );
};
