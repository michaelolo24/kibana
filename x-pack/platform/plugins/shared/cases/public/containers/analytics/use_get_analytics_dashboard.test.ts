/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { waitFor, renderHook } from '@testing-library/react';
import { useToasts, useKibana } from '../../common/lib/kibana';
import { createStartServicesMock } from '../../common/lib/kibana/kibana_react.mock';
import { TestProviders } from '../../common/mock';
import * as api from './api';
import { useGetAnalyticsDashboard } from './use_get_analytics_dashboard';

jest.mock('../../common/lib/kibana');
jest.mock('./api');

const useKibanaMock = useKibana as jest.Mock;

describe('useGetAnalyticsDashboard', () => {
  const addError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useToasts as jest.Mock).mockReturnValue({ addError, addSuccess: jest.fn() });
    useKibanaMock.mockReturnValue({ services: { ...createStartServicesMock() } });
  });

  it('calls getAnalyticsDashboard with the request body and an AbortSignal', async () => {
    const spy = jest.spyOn(api, 'getAnalyticsDashboard');

    renderHook(
      () =>
        useGetAnalyticsDashboard({
          from: '2026-03-01T00:00:00.000Z',
          to: '2026-03-31T23:59:59.999Z',
        }),
      { wrapper: TestProviders }
    );

    await waitFor(() => expect(spy).toHaveBeenCalled());

    const [body, signal] = spy.mock.calls[0];
    expect(body).toEqual({
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-31T23:59:59.999Z',
    });
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('does not fire when enabled is false', async () => {
    const spy = jest.spyOn(api, 'getAnalyticsDashboard');

    renderHook(
      () =>
        useGetAnalyticsDashboard({
          from: '2026-03-01T00:00:00.000Z',
          to: '2026-03-31T23:59:59.999Z',
          enabled: false,
        }),
      { wrapper: TestProviders }
    );

    // Small wait to ensure react-query decided not to fire.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(spy).not.toHaveBeenCalled();
  });

  /**
   * FAILURE SCENARIO: dashboard endpoint throws a 5xx
   * Symptom: user sees the in-page danger prompt AND a toast surface for escalation
   * Log signature: none on client; server-side info log marks the request
   * Trigger: ES down; 500 from the internal dashboard route
   * Recovery: user-initiated retry via the EuiButtonIcon in the empty-prompt actions
   */
  it('toasts the error on failure', async () => {
    jest.spyOn(api, 'getAnalyticsDashboard').mockImplementation(() => {
      throw new Error('Something broke');
    });

    renderHook(
      () =>
        useGetAnalyticsDashboard({
          from: '2026-03-01T00:00:00.000Z',
          to: '2026-03-31T23:59:59.999Z',
        }),
      { wrapper: TestProviders }
    );

    await waitFor(() => expect(addError).toHaveBeenCalled());
  });
});
