/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiPanel,
  EuiTitle,
  EuiSpacer,
  EuiCallOut,
  EuiButtonEmpty,
  EuiSkeletonRectangle,
  EuiText,
} from '@elastic/eui';
import * as i18n from '../translations';

interface PanelWrapperProps {
  title: string;
  subtitle?: string;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  dataTestSubj: string;
  children: React.ReactNode;
}

const PANEL_HEIGHT = 260;

export const PanelWrapper: React.FC<PanelWrapperProps> = React.memo(
  ({ title, subtitle, isLoading, error, onRetry, isEmpty, dataTestSubj, children }) => {
    return (
      <EuiPanel hasBorder paddingSize="m" data-test-subj={dataTestSubj}>
        <EuiTitle size="xs">
          <h3>{title}</h3>
        </EuiTitle>
        {subtitle ? (
          <EuiText size="xs" color="subdued">
            {subtitle}
          </EuiText>
        ) : null}
        <EuiSpacer size="m" />
        {isLoading ? (
          <EuiSkeletonRectangle
            width="100%"
            height={PANEL_HEIGHT}
            data-test-subj={`${dataTestSubj}-loading`}
          />
        ) : error ? (
          <EuiCallOut
            color="danger"
            size="s"
            title={i18n.CARD_ERROR_TITLE}
            data-test-subj={`${dataTestSubj}-error`}
          >
            {onRetry ? (
              <EuiButtonEmpty
                size="xs"
                onClick={onRetry}
                data-test-subj={`${dataTestSubj}-retry`}
              >
                {i18n.CARD_ERROR_RETRY}
              </EuiButtonEmpty>
            ) : null}
          </EuiCallOut>
        ) : isEmpty ? (
          <EuiText size="s" color="subdued" data-test-subj={`${dataTestSubj}-empty`}>
            {i18n.NO_DATA}
          </EuiText>
        ) : (
          <div data-test-subj={`${dataTestSubj}-content`}>{children}</div>
        )}
      </EuiPanel>
    );
  }
);
PanelWrapper.displayName = 'PanelWrapper';
