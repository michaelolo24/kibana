/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiProgress, EuiText, useEuiTheme } from '@elastic/eui';

export interface HorizontalBarRow {
  key: string;
  label: string;
  count: number;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'subdued' | 'accent';
}

export interface HorizontalBarsPanelProps {
  rows: HorizontalBarRow[];
  dataTestSubj: string;
}

export const HorizontalBarsPanel: React.FC<HorizontalBarsPanelProps> = React.memo(
  ({ rows, dataTestSubj }) => {
    const { euiTheme } = useEuiTheme();
    const max = Math.max(...rows.map((r) => r.count), 1);

    return (
      <EuiFlexGroup direction="column" gutterSize="s" data-test-subj={dataTestSubj}>
        {rows.map((row) => (
          <EuiFlexItem key={row.key} grow={false}>
            <EuiFlexGroup
              alignItems="center"
              gutterSize="s"
              responsive={false}
              data-test-subj={`${dataTestSubj}-row-${row.key}`}
            >
              <EuiFlexItem grow={false} css={{ width: euiTheme.size.xxl, minWidth: euiTheme.size.xxl }}>
                <EuiText
                  size="xs"
                  color="subdued"
                  css={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={row.label}
                >
                  {row.label}
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiProgress
                  value={row.count}
                  max={max}
                  size="m"
                  color={row.color ?? 'primary'}
                  aria-label={`${row.label}: ${row.count}`}
                />
              </EuiFlexItem>
              <EuiFlexItem grow={false} css={{ minWidth: euiTheme.size.xl, textAlign: 'right' }}>
                <EuiText size="xs">{row.count.toLocaleString()}</EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    );
  }
);
HorizontalBarsPanel.displayName = 'HorizontalBarsPanel';
