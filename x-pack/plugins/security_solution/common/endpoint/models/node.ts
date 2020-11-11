/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { ResolverGraphNode } from '../types';
import { firstNonNullValue } from './ecs_safety_helpers';

/**
 * Extract the first non null value from the nodeId depending on the datasource. Returns
 * undefined if the field was never set.
 *
 * @param node a graph node containing an id for self-identification and neighbors for identifying immediate connections
 */
export function nodeID(node: ResolverGraphNode): string | undefined {
  return node?.nodeId ? String(firstNonNullValue(node.nodeId)) : undefined;
}

/**
 * @description - Neighbors signifies nodes that are directly connected to the given node.
 * In a tree structure neighbors could either be a single parent or multiple children depending on how the data is provided.
 * In a non-tree structure (cyclic and non-cyclic) this represents all nodes with either outgoing or incoming edges to the current node.
 *
 * @param node a graph node containing an id for self-identification and neighbors for identifying either immediate outgoing or incoming connected nodes.
 */
export function idsForNodeNeighbors(node: ResolverGraphNode): string[] | undefined {
  if (node?.neighbors && Array.isArray(node?.neighbors)) {
    return node.neighbors;
  }
  return undefined;
}
