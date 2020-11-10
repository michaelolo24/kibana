/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { datetime, orderGraphNodesByProperty } from '../process_event';
import { IndexedGraph } from '../../types';
import { ResolverGraphNode } from '../../../../common/endpoint/types';
import { levelOrder as baseLevelOrder } from '../../lib/tree_sequencers';
import * as eventModel from '../../../../common/endpoint/models/event';

/**
 * Create a new IndexedProcessGraph from an array of nodes.
 * Siblings will be ordered by timestamp
 */
export function factory(
  // Array of processes to index as a tree
  nodes: ResolverGraphNode[],
  rootId: string
): IndexedGraph {
  const idToNeighbors = new Map<string | undefined, ResolverGraphNode[]>();
  const idToNode = new Map<string, ResolverGraphNode>();

  for (const node of nodes) {
    const nodeId: string | undefined = eventModel.nodeID(node);
    if (nodeId !== undefined) {
      idToNode.set(nodeId, node); // TODO: Is this necessary given graphableNodes in the selectors?

      // Neighbors signifies nodes that are directly connected to the given node. In a tree structure this is a parent or child.
      const neighborIds: string[] | undefined = eventModel.idsForNodeNeighbors(node);

      if (neighborIds) {
        for (const neighborId of neighborIds) {
          // TODO: This works in a single parent (tree) scenario, but the logic should change to allow for levels with a general purpose graph
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

  // sort the children of each node
  for (const siblings of idToNeighbors.values()) {
    siblings.sort((firstNode, secondNode) =>
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
 * Returns an array with any neighbor ids of the passed in `nodeId`.
 */
export function neighbors(
  indexedGraph: IndexedGraph,
  nodeId: string | undefined
): ResolverGraphNode[] {
  const currentNeighbors = indexedGraph.idToNeighbors.get(nodeId);
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
 * Returns the parent node for a given set of neighbors. In a tree this would be the parent node.
 */
export function parents(
  indexedGraph: IndexedGraph,
  node: ResolverGraphNode
): ResolverGraphNode[] | undefined {
  const neighborIds = eventModel.idsForNodeNeighbors(node);
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
  while (parents(indexedGraph, current) !== undefined && parents(indexedGraph, current)?.[0]) {
    current = parents(indexedGraph, current)![0]; // TODO: Fix this parent issue
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
      neighbors(indexedGraph, eventModel.nodeID(parentNode))
    );
  }
}
