/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TimeRange } from '@kbn/es-query';
import { EuiPanel, EuiTitle, EuiSpacer, EuiText } from '@elastic/eui';
import { useKibana } from '../../../common/lib/kibana';
import { useCasesContext } from '../../cases_context/use_cases_context';
import { getVolumeLensAttributes } from './get_volume_lens_attributes';
import * as i18n from '../translations';

interface LensVolumePanelProps {
  timeRange: TimeRange;
  dataTestSubj?: string;
}

const LENS_HEIGHT = 240;

/**
 * Volume-over-time panel rendered as a Lens stacked-bar XY chart. Owner scoping reads from
 * `CasesContext` so Security, Observability, and Stack each see only their own case flow.
 */
export const LensVolumePanel: React.FC<LensVolumePanelProps> = React.memo(
  ({ timeRange, dataTestSubj = 'cases-dashboard-volume-lens' }) => {
    const { lens } = useKibana().services;
    const { owner } = useCasesContext();

    // Generate Lens-internal IDs once — they must stay stable across renders.
    const ids = useMemo(
      () => ({
        layerOpened: uuidv4(),
        layerClosed: uuidv4(),
        dataView: uuidv4(),
        columnBucket: uuidv4(),
        columnOpened: uuidv4(),
        columnClosedBucket: uuidv4(),
        columnClosed: uuidv4(),
      }),
      []
    );

    const attributes = useMemo(() => {
      const built = getVolumeLensAttributes({ owner, ids });
      if (process.env.NODE_ENV !== 'production') {
        const layers = (built.state?.datasourceStates as { textBased?: { layers?: Record<string, { query?: { esql?: string } }> } })?.textBased?.layers ?? {};
        Object.entries(layers).forEach(([layerId, layer]) => {
          // eslint-disable-next-line no-console
          console.debug(`[cases:dashboard:volume] layer=${layerId.slice(0, 8)} owner=${JSON.stringify(owner)} esql=${layer.query?.esql}`);
        });
      }
      return built;
    }, [owner, ids]);

    if (!lens?.EmbeddableComponent) {
      return null;
    }

    const { EmbeddableComponent } = lens;

    return (
      <EuiPanel hasBorder paddingSize="m" data-test-subj={dataTestSubj}>
        <EuiTitle size="xs">
          <h3>{i18n.VOLUME_TITLE}</h3>
        </EuiTitle>
        <EuiText size="xs" color="subdued">
          {i18n.WINDOW_DESCRIPTION}
        </EuiText>
        <EuiSpacer size="m" />
        <div style={{ height: LENS_HEIGHT }}>
          <EmbeddableComponent
            id="cases-dashboard-volume"
            attributes={attributes}
            timeRange={timeRange}
            renderMode="view"
            disableTriggers
            executionContext={{ type: 'cases', name: 'analytics-dashboard' }}
            syncTooltips={false}
            syncCursor={false}
          />
        </div>
      </EuiPanel>
    );
  }
);
LensVolumePanel.displayName = 'LensVolumePanel';
