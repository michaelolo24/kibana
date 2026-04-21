/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../common/mock';
import { CasesHomeTabs } from './cases_home_tabs';

// The list and dashboard bodies render heavy children we don't need here.
jest.mock('./all_cases_list', () => ({
  AllCasesList: () => <div data-test-subj="mock-all-cases-list" />,
}));

jest.mock('../dashboard/cases_dashboard', () => ({
  CasesDashboard: () => <div data-test-subj="mock-cases-dashboard" />,
}));

// Suppress shell side effects (license fetching, breadcrumbs).
jest.mock('./cases_page_shell', () => ({
  CasesPageShell: ({ children }: { children: React.ReactNode }) => (
    <div data-test-subj="mock-shell">{children}</div>
  ),
}));

jest.mock('./index', () => ({
  AllCases: () => <div data-test-subj="mock-full-all-cases" />,
}));

describe('CasesHomeTabs', () => {
  /**
   * FAILURE SCENARIO: feature flag off must render exactly today's home page
   * Symptom: adding the tabs wrapper inadvertently alters the default page
   * Log signature: n/a — covered purely in test
   * Trigger: `features.analyticsDashboard.enabled` absent or false
   * Recovery: n/a — test prevents regression
   */
  it('renders the existing AllCases component when the feature flag is off', () => {
    render(
      <TestProviders features={{ analyticsDashboard: { enabled: false } }}>
        <CasesHomeTabs />
      </TestProviders>
    );

    expect(screen.getByTestId('mock-full-all-cases')).toBeInTheDocument();
    expect(screen.queryByTestId('cases-home-tabs')).not.toBeInTheDocument();
  });

  it('renders the tab strip and defaults to the Cases tab when the flag is on', () => {
    render(
      <TestProviders features={{ analyticsDashboard: { enabled: true } }}>
        <CasesHomeTabs />
      </TestProviders>
    );

    expect(screen.getByTestId('cases-home-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('mock-all-cases-list')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-cases-dashboard')).not.toBeInTheDocument();
  });

  it('switches to the Dashboard body when the Dashboard tab is clicked', async () => {
    render(
      <TestProviders features={{ analyticsDashboard: { enabled: true } }}>
        <CasesHomeTabs />
      </TestProviders>
    );

    expect(screen.getByTestId('mock-all-cases-list')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-cases-dashboard')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('cases-home-tab-dashboard'));

    expect(screen.getByTestId('mock-cases-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-all-cases-list')).not.toBeInTheDocument();
  });

  it('switches back to the Cases body when the Cases tab is clicked', async () => {
    render(
      <TestProviders features={{ analyticsDashboard: { enabled: true } }}>
        <CasesHomeTabs />
      </TestProviders>
    );

    await userEvent.click(screen.getByTestId('cases-home-tab-dashboard'));
    await userEvent.click(screen.getByTestId('cases-home-tab-cases'));

    expect(screen.getByTestId('mock-all-cases-list')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-cases-dashboard')).not.toBeInTheDocument();
  });
});
