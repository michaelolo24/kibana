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
 * siblings will be ordered by timestamp
 */
export function factory(
  // Array of processes to index as a tree
  nodes: ResolverGraphNode[],
  rootId: string
): IndexedGraph {
  const idToConnections = new Map<string | undefined, ResolverGraphNode[]>();
  const idToNode = new Map<string, ResolverGraphNode>();

  for (const node of nodes) {
    const nodeId: string | undefined = eventModel.nodeID(node);
    if (nodeId !== undefined) {
      idToNode.set(nodeId, node);

      const uniqueConnections: string | undefined = eventModel.nodeConnections(node);

      let nodesConnectedToSameParent = idToConnections.get(uniqueConnections);
      if (!nodesConnectedToSameParent) {
        nodesConnectedToSameParent = [];
        idToConnections.set(uniqueConnections, nodesConnectedToSameParent);
      }
      nodesConnectedToSameParent.push(node);
    }
  }

  // sort the children of each node
  for (const siblings of idToConnections.values()) {
    siblings.sort((firstNode, secondNode) =>
      orderGraphNodesByProperty(firstNode.data, secondNode.data, '@timestamp', datetime)
    );
  }

  return {
    rootId,
    idToConnections, // TODO: figure this out for graph, parent(s) connected to children
    idToNode,
  };
}

/**
 * Returns an array with any children `ProcessEvent`s of the passed in `process`
 */
export function connections(
  graph: IndexedGraph,
  connectionId: string | undefined
): ResolverGraphNode[] {
  const currentNodeSiblings = graph.idToConnections.get(connectionId);
  return currentNodeSiblings === undefined ? [] : currentNodeSiblings;
}

/**

/**
 * Get the indexed process event for the ID
 */
export function nodeData(graph: IndexedGraph, nodeId: string): ResolverGraphNode | null {
  return graph.idToNode.get(nodeId) ?? null;
}

/**
 * Returns the parent ProcessEvent, if any, for the passed in `childProcess`
 */
export function connection(
  graph: IndexedGraph,
  connectedNode: ResolverGraphNode
): ResolverGraphNode[] | undefined {
  const uniqueConnections = eventModel.nodeConnections(connectedNode);
  if (uniqueConnections === undefined) {
    return undefined;
  } else {
    return graph.idToConnections.get(uniqueConnections);
  }
}

/**
 * Number of processes in the graph
 */
export function size(graph: IndexedGraph) {
  return graph.idToNode.size;
}

/**
 * Return the root process
 */
export function graphRoot(graph: IndexedGraph): ResolverGraphNode | null {
  if (size(graph) === 0) {
    return null;
  }
  if (graph.rootId) {
    const root = graph.idToNode.get(graph.rootId);
    return root ? root : null;
  }

  return null;
}

/**
 * Yield processes in level order
 */
export function* levelOrder(graph: IndexedGraph) {
  const rootNode = graphRoot(graph);
  if (rootNode !== null) {
    yield* baseLevelOrder(rootNode, (graphNode: ResolverGraphNode): ResolverGraphNode[] =>
      connections(graph, eventModel.nodeConnections(graphNode))
    );
  }
}
