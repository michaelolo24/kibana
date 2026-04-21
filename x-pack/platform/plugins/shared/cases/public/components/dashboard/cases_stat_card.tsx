/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiPanel,
  EuiStat,
  EuiSkeletonRectangle,
  EuiCallOut,
  EuiButtonEmpty,
  EuiIconTip,
  EuiLink,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiText,
} from '@elastic/eui';
import * as i18n from './translations';

export interface CasesStatCardProps {
  title: string;
  value: string | number | null;
  description: string;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  tooltip?: string;
  href?: string;
  dataTestSubj: string;
}

const STAT_CARD_HEIGHT = 88;

export const CasesStatCard: React.FC<CasesStatCardProps> = React.memo(
  ({ title, value, description, isLoading, error, onRetry, tooltip, href, dataTestSubj }) => {
    if (isLoading) {
      return (
        <EuiPanel hasBorder paddingSize="m" data-test-subj={`${dataTestSubj}-loading`}>
          <EuiSkeletonRectangle width="100%" height={STAT_CARD_HEIGHT} />
        </EuiPanel>
      );
    }

    if (error) {
      return (
        <EuiPanel hasBorder paddingSize="m" data-test-subj={`${dataTestSubj}-error`}>
          <EuiCallOut color="danger" size="s" title={i18n.CARD_ERROR_TITLE}>
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
        </EuiPanel>
      );
    }

    const displayValue = value === null || value === undefined ? '—' : value;
    const ariaLabel = `${title}: ${
      value === null || value === undefined ? i18n.NO_DATA : value
    } ${description}`;

    return (
      <EuiPanel hasBorder paddingSize="m" data-test-subj={dataTestSubj}>
        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
          <EuiFlexItem>
            <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiText size="s" color="subdued">
                  <span>{title}</span>
                </EuiText>
              </EuiFlexItem>
              {tooltip ? (
                <EuiFlexItem grow={false}>
                  <EuiIconTip content={tooltip} type="iInCircle" color="subdued" />
                </EuiFlexItem>
              ) : null}
            </EuiFlexGroup>
            <EuiStat
              title={displayValue}
              description={description}
              titleSize="l"
              textAlign="left"
              aria-label={ariaLabel}
              isLoading={false}
            />
          </EuiFlexItem>
          {href ? (
            <EuiFlexItem grow={false}>
              <EuiLink
                href={href}
                aria-label={`${i18n.UNASSIGNED_DESCRIPTION} — ${title}`}
                data-test-subj={`${dataTestSubj}-link`}
              >
                <EuiIcon type="arrowRight" color="primary" />
              </EuiLink>
            </EuiFlexItem>
          ) : null}
        </EuiFlexGroup>
      </EuiPanel>
    );
  }
);
CasesStatCard.displayName = 'CasesStatCard';
