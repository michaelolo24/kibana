/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { GraphVisualization } from '@kbn/graph-plugin/public/components/graph_visualization';
import { createWorkspace } from '@kbn/graph-plugin/public/services/workspace';
import type { Workspace } from '@kbn/graph-plugin/public/types';
import { useGraphQuery } from './use-graph-query';

// const nodes = [
//   {
//     id: '1',
//     color: 'black',
//     data: {
//       field: 'A',
//       term: '1',
//     },
//     icon: {
//       class: 'a',
//       code: 'a',
//       label: '',
//     },
//     isSelected: true,
//     kx: 5,
//     ky: 5,
//     label: '1',
//     numChildren: 1,
//     parent: null,
//     scaledSize: 10,
//     x: 5,
//     y: 5,
//   },
//   {
//     id: '2',
//     color: 'red',
//     data: {
//       field: 'B',
//       term: '2',
//     },
//     icon: {
//       class: 'b',
//       code: 'b',
//       label: '',
//     },
//     isSelected: false,
//     kx: 7,
//     ky: 9,
//     label: '2',
//     numChildren: 0,
//     parent: null,
//     scaledSize: 10,
//     x: 7,
//     y: 9,
//   },
//   {
//     id: '3',
//     color: 'yellow',
//     data: {
//       field: 'C',
//       term: '3',
//     },
//     icon: {
//       class: 'c',
//       code: 'c',
//       label: '',
//     },
//     isSelected: false,
//     kx: 12,
//     ky: 2,
//     label: '3',
//     numChildren: 0,
//     parent: null,
//     scaledSize: 10,
//     x: 7,
//     y: 9,
//   },
// ];
// const edges = [
//   {
//     isSelected: true,
//     label: '',
//     topSrc: nodes[0],
//     topTarget: nodes[1],
//     source: nodes[0],
//     target: nodes[1],
//     weight: 10,
//     width: 2,
//   },
//   {
//     isSelected: true,
//     label: '',
//     topSrc: nodes[1],
//     topTarget: nodes[2],
//     source: nodes[1],
//     target: nodes[2],
//     weight: 10,
//     width: 2.2,
//   },
// ];
// const workspace = {
//   nodes,
//   edges,
//   selectNone: () => {},
//   changeHandler: () => {},
//   toggleNodeSelection: (node) => {
//     return !node.isSelected;
//   },
//   getAllIntersections: () => {},
//   removeEdgeFromSelection: () => {},
//   addEdgeToSelection: () => {},
//   getEdgeSelection: () => {},
//   clearEdgeSelection: () => {},
// };

export const AlertDetailsVisualizeGraph = React.memo(({ id }: { id: string }) => {
  const getGraph = useGraphQuery(id);
  const [ranLayout, updateRanLayout] = useState(false);
  const [workspace, updateWorkspace] = useState<Workspace | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!workspace) {
      updateWorkspace(
        createWorkspace({
          indexName: '.alerts-security.alerts-default',
          vertex_fields: [
            {
              selected: false,
              color: 'blue',
              name: 'kibana.alert.uuid',
              type: 'string',
              icon: {
                class: 'fa-cube',
                code: '\uf1b2',
                label: 'Alert',
              },
              aggregatable: true,
            },
            {
              selected: false,
              color: 'yellow',
              name: 'host.name',
              type: 'string',
              icon: {
                class: 'fa-home',
                code: '\uf015',
                label: 'Host',
              },
              aggregatable: true,
            },
            {
              selected: false,
              color: 'red',
              name: 'user.name',
              type: 'string',
              icon: {
                class: 'fa-user',
                code: '\uf007',
                label: 'User',
              },
              aggregatable: true,
            },
          ],
          // Here we have the opportunity to look up labels for nodes...
          nodeLabeller() {
            // console.log(newNodes);
          },
          changeHandler: () => {},
          graphExploreProxy: getGraph,
          exploreControls: {
            useSignificance: false,
            sampleSize: 2000,
            timeoutMillis: 5000,
            sampleDiversityField: null,
            maxValuesPerDoc: 1,
            minDocCount: 1,
          },
        })
      );
    }
  }, [getGraph, workspace]);

  useEffect(() => {
    if (workspace && !loaded) {
      workspace.callElasticsearch({});
      setLoaded(true);
    }
  }, [workspace, loaded]);

  useEffect(() => {
    if (loaded && workspace && workspace?.nodes.length > 0 && !ranLayout) {
      workspace.runLayout();
      updateRanLayout(true);
    }
  }, [loaded, ranLayout, workspace, workspace?.nodes.length]);

  return workspace && loaded ? (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        background: $euiColorEmptyShade;
        min-height: 500px;
        position: relative;
        flex: 1;

        @mixin gphSvgText() {
          font-family: $euiFontFamily;
          font-size: $euiSizeS;
          line-height: $euiSizeM;
          fill: $euiColorDarkShade;
          color: $euiColorDarkShade;
        }

        .gphGraph {
          flex: 1;
          overflow: hidden;
        }

        .gphEdge {
          fill: $euiColorMediumShade;
          stroke: $euiColorMediumShade;
          stroke-width: 2;
          stroke-opacity: 0.5;

          &--selected {
            stroke: $euiColorDarkShade;
            stroke-opacity: 0.95;
          }
        }

        .gphEdge--clickable {
          fill: transparent;
          opacity: 0;
        }

        .gphEdge--wrapper:hover {
          .gphEdge {
            stroke-opacity: 0.95;
            cursor: pointer;
          }
        }

        .gphNode {
          cursor: pointer;
        }

        .gphNode__label {
          @include gphSvgText;
          cursor: pointer;
          &--html {
            @include euiTextTruncate;
            text-align: center;
          }
        }

        .gphNode__markerCircle {
          fill: $euiColorDarkShade;
          stroke: $euiColorEmptyShade;
        }

        .gphNode__markerText {
          @include gphSvgText;
          font-size: $euiSizeS - 2px;
          fill: $euiColorEmptyShade;
        }

        .gphNode__circle {
          fill: $euiColorMediumShade;
          &--selected {
            stroke-width: $euiSizeXS;
            stroke: transparentize($euiColorPrimary, 0.25);
          }
        }

        .gphNode__text {
          fill: $euiColorInk;

          &--inverse {
            fill: $euiColorGhost;
          }
        }
      `}
      id="GraphSvgContainer"
    >
      <div
        css={css`
          flex: 1;
          min-height: 500px;
          display: flex;
          flex-direction: column;
        `}
      >
        <button type="button" onClick={workspace.runLayout.bind(workspace)}>
          {'Click Me'}
        </button>
        <GraphVisualization
          workspace={workspace}
          selectSelected={() => {}}
          onSetControl={() => {}}
          onSetMergeCandidates={() => {}}
        />
      </div>
    </div>
  ) : (
    <>{'Testing'}</>
  );
});

AlertDetailsVisualizeGraph.displayName = 'AlertDetailsVisualizeGraph';
