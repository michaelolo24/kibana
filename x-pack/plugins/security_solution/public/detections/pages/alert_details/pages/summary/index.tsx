/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiTitle, EuiHorizontalRule, EuiSpacer, EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import type { Severity } from '@kbn/securitysolution-io-ts-alerting-types';
import type { TimelineEventsDetailsItem, TimelineItem } from '@kbn/timelines-plugin/common';
import { TimelineId } from '@kbn/timelines-plugin/common';
import React, { useMemo, useRef } from 'react';
import { find } from 'lodash/fp';
import { useSourcererDataView } from '../../../../../common/containers/sourcerer';
import { SeverityBadge } from '../../../../components/rules/severity_badge';
import type { Ecs } from '../../../../../../common/ecs';
import { Reason } from '../../../../../common/components/event_details/reason';
import { StatefulRowRenderer } from '../../../../../timelines/components/timeline/body/events/stateful_row_renderer';
import { defaultRowRenderers } from '../../../../../timelines/components/timeline/body/renderers';
import { AlertCases } from '../../components/case';
import { SIGNAL_RULE_NAME_FIELD_NAME } from '../../../../../timelines/components/timeline/body/renderers/constants';
import { getEnrichedFieldInfo } from '../../../../../common/components/event_details/helpers';
import { SourcererScopeName } from '../../../../../common/store/sourcerer/model';
import { FormattedFieldValue } from '../../../../../timelines/components/timeline/body/renderers/formatted_field';

export const AlertSummary = React.memo(
  ({
    data,
    id,
    event,
    ecsData,
  }: {
    data: TimelineEventsDetailsItem[] | null;
    id: string;
    event: TimelineItem;
    ecsData: Ecs | null;
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const getFieldValue = (field: string) => {
      const valueArray = data?.find((datum) => datum.field === field)?.values;
      return valueArray && valueArray.length > 0 ? valueArray[0] : '';
    };
    const { browserFields } = useSourcererDataView(SourcererScopeName.detections);

    const ruleNameData = useMemo(() => {
      const item = find({ field: SIGNAL_RULE_NAME_FIELD_NAME, category: 'kibana' }, data);
      const linkValueField = find({ field: 'kibana.alert.rule.uuid', category: 'kibana' }, data);
      return (
        item &&
        getEnrichedFieldInfo({
          eventId: id,
          contextId: TimelineId.active,
          timelineId: TimelineId.active,
          browserFields,
          item,
          linkValueField,
        })
      );
    }, [browserFields, data, id]);

    return (
      <>
        {data && (
          <>
            <EuiSpacer />
            <EuiFlexGroup>
              <EuiFlexItem grow={2}>
                <EuiTitle size="s">
                  <h3>{'Alert summary'}</h3>
                </EuiTitle>
                <EuiHorizontalRule />
                <EuiTitle size="xs">
                  <h4>{'Alert reason'}</h4>
                </EuiTitle>
                <EuiSpacer size="xs" />
                <Reason eventId={id} data={data} />
                <EuiSpacer />
                <EuiTitle size="xxs">
                  <h5>{'Event render'}</h5>
                </EuiTitle>
                <EuiSpacer size="xs" />
                <div ref={containerRef}>
                  <StatefulRowRenderer
                    ariaRowindex={0}
                    containerRef={containerRef}
                    event={{ ...event, ecs: ecsData }}
                    lastFocusedAriaColindex={0}
                    rowRenderers={defaultRowRenderers}
                    timelineId={TimelineId.active}
                  />
                </div>
                <EuiFlexGroup>
                  <EuiFlexItem grow={2}>
                    <EuiTitle size="xxs">
                      <h5>{'Rule name'}</h5>
                    </EuiTitle>
                    <EuiSpacer size="xs" />
                    <FormattedFieldValue
                      contextId={TimelineId.active}
                      eventId={id}
                      value={ruleNameData?.values[0]}
                      fieldName={ruleNameData?.data.field}
                      linkValue={ruleNameData?.linkValue}
                      fieldType={ruleNameData?.data.type}
                      fieldFormat={ruleNameData?.data.format}
                      isDraggable={false}
                      truncate={false}
                    />
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiTitle size="xxs">
                      <h5>{'Risk score'}</h5>
                    </EuiTitle>
                    <EuiSpacer size="xs" />
                    {getFieldValue('kibana.alert.risk_score')}
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiTitle size="xxs">
                      <h5>{'Severity'}</h5>
                    </EuiTitle>
                    <EuiSpacer size="xs" />
                    <SeverityBadge value={getFieldValue('kibana.alert.severity') as Severity} />
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="l" />
                <EuiFlexGroup>
                  <EuiFlexItem grow={2}>
                    <EuiTitle size="xxs">
                      <h5>{'Rule description'}</h5>
                    </EuiTitle>
                    <EuiSpacer size="xs" />
                    {getFieldValue('kibana.alert.rule.description')}
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiTitle size="s">
                  <h3>{'Case'}</h3>
                </EuiTitle>
                <EuiHorizontalRule />
                <AlertCases eventId={id} />
              </EuiFlexItem>
            </EuiFlexGroup>
          </>
        )}
      </>
    );
  }
);

AlertSummary.displayName = 'AlertSummary';
