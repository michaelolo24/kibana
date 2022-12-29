/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { EuiFlyoutProps } from '@elastic/eui';
import { EuiFlexGroup, EuiFlexItem, EuiFlyout } from '@elastic/eui';

// The expandable flyout should only worry about visual information and rendering components based on the ID provided.
// This *should* be able to be exported to a package
export interface ExpandableFlyoutViews {
  sectionId?: string;
  component: React.ReactElement;
  size: number;
}

export interface ExpandableFlyoutProps extends EuiFlyoutProps {
  leftSectionActiveId: string | null;
  leftSectionCollapsed?: boolean;
  panels: ExpandableFlyoutViews[];
  rightSectionActiveId: string | null;
  rightSectionCollapsed?: boolean;
}

export const ExpandableFlyout: React.FC<ExpandableFlyoutProps> = ({
  leftSectionActiveId,
  leftSectionCollapsed,
  panels,
  rightSectionActiveId,
  rightSectionCollapsed,
  ...flyoutProps
}) => {
  const leftSection = panels.find((sectionView) => sectionView.sectionId === leftSectionActiveId);
  const rightSection = panels.find((sectionView) => sectionView.sectionId === rightSectionActiveId);

  const flyoutSize = (leftSection?.size ?? 0) + (rightSection?.size ?? 0);

  if (!rightSection) return null;

  return (
    <EuiFlyout {...flyoutProps} size={flyoutSize}>
      <EuiFlexGroup direction={leftSection ? 'row' : 'column'} wrap={false} style={{ height: '100%' }}>
        {leftSection ? (
          <EuiFlexItem grow>
            <EuiFlexGroup direction="column" style={{ maxWidth: leftSection.size, width: 'auto' }}>
              {leftSection.component}
            </EuiFlexGroup>
          </EuiFlexItem>
        ) : null}
        <EuiFlexItem grow={false} style={{ height: '100%', borderLeft: '1px solid #ccc' }}>
          <EuiFlexGroup direction="column" style={{ width: rightSection.size }}>
            {rightSection.component}
          </EuiFlexGroup>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiFlyout>
  );
};
