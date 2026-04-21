/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TypedLensByValueInput } from '@kbn/lens-plugin/public';

export const CASES_SO_INDEX = '.kibana_alerting_cases';

export interface GetVolumeLensAttributesArgs {
  /**
   * Owner values to scope the query by (e.g. `['securitySolution']`). Values come from the
   * trusted `CasesContext.owner` set by the solution mount, not from user input — safe to
   * interpolate with JSON-escaped quoting.
   */
  owner: string[];
  /** Stable identifiers — keep constant across renders so Lens doesn't remount. */
  ids: {
    layerOpened: string;
    layerClosed: string;
    dataView: string;
    columnBucket: string;
    columnOpened: string;
    columnClosedBucket: string;
    columnClosed: string;
  };
}

/**
 * Produce a quoted ES|QL string literal list like `"a", "b"`. JSON.stringify on a string
 * escapes embedded quotes and control characters which makes it safe to drop into an ES|QL
 * `IN (…)` clause even if an owner value contained a double quote.
 */
const esqlStringList = (values: string[]): string =>
  values.map((v) => JSON.stringify(v)).join(', ');

/**
 * Two-layer XY chart: layer A counts cases by `created_at` day (series: "Opened"),
 * layer B counts by `closed_at` day (series: "Closed"). Both layers share one ad-hoc
 * data view that targets the Cases SO index. The layers render as stacked bars because
 * `preferredSeriesType: 'bar_stacked'`.
 */
export const getVolumeLensAttributes = ({
  owner,
  ids,
}: GetVolumeLensAttributesArgs): TypedLensByValueInput['attributes'] => {
  const ownerClause = owner.length > 0 ? `| WHERE cases.attributes.owner IN (${esqlStringList(owner)})` : '';

  const openedEsql = [
    `FROM ${CASES_SO_INDEX} METADATA _id`,
    `| WHERE type == "cases"`,
    ownerClause,
    `| WHERE cases.attributes.created_at IS NOT NULL`,
    `| EVAL bucket = DATE_TRUNC(1 day, cases.attributes.created_at)`,
    `| STATS opened = COUNT(*) BY bucket`,
    `| SORT bucket ASC`,
    `| LIMIT 365`,
  ]
    .filter(Boolean)
    .join(' ');

  const closedEsql = [
    `FROM ${CASES_SO_INDEX} METADATA _id`,
    `| WHERE type == "cases"`,
    ownerClause,
    `| WHERE cases.attributes.closed_at IS NOT NULL`,
    `| EVAL bucket = DATE_TRUNC(1 day, cases.attributes.closed_at)`,
    `| STATS closed = COUNT(*) BY bucket`,
    `| SORT bucket ASC`,
    `| LIMIT 365`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    title: 'Case volume',
    description: '',
    visualizationType: 'lnsXY',
    references: [],
    state: {
      query: { language: 'kuery', query: '' },
      filters: [],
      internalReferences: [
        {
          type: 'index-pattern',
          id: ids.dataView,
          name: `indexpattern-datasource-layer-${ids.layerOpened}`,
        },
        {
          type: 'index-pattern',
          id: ids.dataView,
          name: `indexpattern-datasource-layer-${ids.layerClosed}`,
        },
      ],
      adHocDataViews: {
        [ids.dataView]: {
          id: ids.dataView,
        },
      },
      datasourceStates: {
        textBased: {
          layers: {
            [ids.layerOpened]: {
              index: ids.dataView,
              query: { esql: openedEsql },
              columns: [
                {
                  columnId: ids.columnBucket,
                  fieldName: 'bucket',
                  meta: { type: 'date' },
                },
                {
                  columnId: ids.columnOpened,
                  fieldName: 'opened',
                  meta: { type: 'number' },
                  inMetricDimension: true,
                },
              ],
              timeField: 'bucket',
            },
            [ids.layerClosed]: {
              index: ids.dataView,
              query: { esql: closedEsql },
              columns: [
                {
                  columnId: ids.columnClosedBucket,
                  fieldName: 'bucket',
                  meta: { type: 'date' },
                },
                {
                  columnId: ids.columnClosed,
                  fieldName: 'closed',
                  meta: { type: 'number' },
                  inMetricDimension: true,
                },
              ],
              timeField: 'bucket',
            },
          },
        },
      },
      visualization: {
        legend: { isVisible: true, position: 'top' },
        valueLabels: 'hide',
        preferredSeriesType: 'bar_stacked',
        axisTitlesVisibilitySettings: { x: false, yLeft: false, yRight: false },
        fittingFunction: 'None',
        layers: [
          {
            layerId: ids.layerOpened,
            seriesType: 'bar_stacked',
            xAccessor: ids.columnBucket,
            accessors: [ids.columnOpened],
            layerType: 'data',
          },
          {
            layerId: ids.layerClosed,
            seriesType: 'bar_stacked',
            xAccessor: ids.columnClosedBucket,
            accessors: [ids.columnClosed],
            layerType: 'data',
          },
        ],
      },
    },
  } as TypedLensByValueInput['attributes'];
};
