/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { datetime, orderGraphNodesByProperty } from '../process_event';
import { IndexedGraph } from '../../types';
import { ResolverGraphNode } from '../../../../common/endpoint/types';
import { levelOrder as baseLevelOrder } from '../../lib/tree_sequencers';
import * as nodeModel from '../../../../common/endpoint/models/node';

/**
 * Create a new IndexedProcessGraph from an array of nodes.
 * Siblings will be ordered by timestamp
 */
export function factory(
  // Array of processes to index as a tree
  nodes: ResolverGraphNode[],
  rootId: string
): IndexedGraph {
  const idToNeighbors = new Map<string, ResolverGraphNode[]>();
  const idToNode = new Map<string, ResolverGraphNode>();

  for (const node of nodes) {
    const nodeId: string | undefined = nodeModel.nodeID(node);
    if (nodeId !== undefined) {
      idToNode.set(nodeId, node);

      const neighborIds: string[] | undefined = nodeModel.idsForNodeNeighbors(node);

      if (neighborIds) {
        for (const neighborId of neighborIds) {
          let nodesConnectedToTheSameNeighbor = idToNeighbors.get(neighborId);
          if (!nodesConnectedToTheSameNeighbor) {
            nodesConnectedToTheSameNeighbor = [];
            idToNeighbors.set(neighborId, nodesConnectedToTheSameNeighbor);
          }
          nodesConnectedToTheSameNeighbor.push(node);
        }
      }
    }
  }

  // sort the neighbors
  for (const nodeNeighbors of idToNeighbors.values()) {
    nodeNeighbors.sort((firstNode, secondNode) =>
      // TODO: Potentially store the `sortField` on ResolverGraph and allow users to change
      // TODO: Create modifier library (i.e. datetime fields => datetime, string fields => lowercase?, etc...)
      orderGraphNodesByProperty(firstNode.data, secondNode.data, '@timestamp', datetime)
    );
  }

  return {
    rootId,
    idToNeighbors,
    idToNode,
  };
}

/**
 * Returns an array of any source node associated with a set of neighbors.
 * Reverse of neighborNodesofSource
 */
export function sourceNodesOfNeighbors(
  indexedGraph: IndexedGraph,
  nodeId: string | undefined
): ResolverGraphNode[] {
  const currentNeighbors = indexedGraph.idToNeighbors.get(nodeId);
  // You should never recieve an undefined array given the check in `factory`
  return currentNeighbors === undefined ? [] : currentNeighbors;
}

/**

/**
 * Get the indexed process event for the ID
 */
export function nodeData(graph: IndexedGraph, nodeId: string): ResolverGraphNode | null {
  return graph.idToNode.get(nodeId) ?? null;
}

/**
 * Returns the nodes that are neighbors of a given node
 * In a tree structure this will be the parents or children of a node depending on how the data is structures.
 */
export function neighborNodesOfSource(
  indexedGraph: IndexedGraph,
  node: ResolverGraphNode
): ResolverGraphNode[] | undefined {
  const neighborIds = nodeModel.idsForNodeNeighbors(node);
  if (neighborIds === undefined || neighborIds.length === 0) {
    return undefined;
  } else {
    return neighborIds.reduce((allNeighbors: ResolverGraphNode[], neighborId) => {
      const neighbor = indexedGraph.idToNode.get(neighborId);
      return neighbor ? [...allNeighbors, neighbor] : allNeighbors;
    }, []);
  }
}

/**
 * Number of nodes in the graph
 */
export function size(graph: IndexedGraph) {
  return graph.idToNode.size;
}

/**
 * Return the root node
 */
export function graphRoot(indexedGraph: IndexedGraph): ResolverGraphNode | null {
  // TODO: Keep track of visited nodes to handle cycles in a graph
  if (size(indexedGraph) === 0) {
    return null;
  }

  // TODO: For now since there is only one parent in our data sources this works.
  // TODO: Handle the scenario where we pontentially have multiple trees with roots or single nodes, etc...
  let current: ResolverGraphNode = indexedGraph.idToNode.values().next().value;
  while (
    neighborNodesOfSource(indexedGraph, current) !== undefined &&
    neighborNodesOfSource(indexedGraph, current)?.[0]
  ) {
    current = neighborNodesOfSource(indexedGraph, current)![0]; // TODO: Fix this parent issue
  }
  return current;
}

/**
 * Yield processes in level order
 */
export function* levelOrder(indexedGraph: IndexedGraph) {
  const rootNode = graphRoot(indexedGraph);
  if (rootNode !== null) {
    yield* baseLevelOrder(rootNode, (parentNode: ResolverGraphNode): ResolverGraphNode[] =>
      sourceNodesOfNeighbors(indexedGraph, nodeModel.nodeID(parentNode))
    );
  }
}
