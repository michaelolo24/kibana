/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import _ from 'lodash';
import { IScopedClusterClient } from 'kibana/server';
import { ResolverNode } from '../../../../../../common/endpoint/types';
import { DescendantsQuery } from '../queries/descendants';
import { Schema, NodeID } from './index';
import { LifecycleQuery } from '../queries/lifecycle';
import { StatsQuery } from '../queries/stats';

/**
 * The query parameters passed in from the request. These define the limits for the ES requests for retrieving the
 * resolver tree.
 */
export interface TreeOptions {
  descendantLevels: number;
  descendants: number;
  ancestors: number;
  timerange: {
    from: string;
    to: string;
  };
  schema: Schema;
  nodes: NodeID[];
  indexPatterns: string[];
}

/**
 * Handles retrieving nodes of a resolver tree.
 */
export class Fetcher {
  constructor(private readonly client: IScopedClusterClient) {}

  /**
   * This method retrieves the ancestors and descendants of a resolver tree.
   *
   * @param options the options for retrieving the structure of the tree.
   */
  public async tree(options: TreeOptions) {
    const treeParts = await Promise.all([
      this.retrieveAncestors(options),
      this.retrieveDescendants(options),
    ]);

    const tree = treeParts.reduce((results, partArray) => {
      results.push(...partArray);
      return results;
    }, []);

    return this.applyStatsToTree(tree, options);
  }

  private async applyStatsToTree(
    treeNodes: unknown[],
    options: TreeOptions
  ): Promise<ResolverNode[]> {
    const statsIDs: NodeID[] = [];
    for (const node of treeNodes) {
      const id = getIDField(node, options.schema);
      if (id) {
        statsIDs.push(id);
      }
    }

    // if (statsIDs.length === 0) {
    //   return [];
    // }

    const query = new StatsQuery({
      indexPatterns: options.indexPatterns,
      schema: options.schema,
      timerange: options.timerange,
    });

    const eventStats = await query.search(this.client, statsIDs);
    const statsNodes: ResolverNode[] = [];
    for (const node of treeNodes) {
      const id = getIDField(node, options.schema);
      const stats = id !== undefined ? eventStats[id] : undefined;
      statsNodes.push({
        data: node,
        stats: stats ?? { total: 0, byCategory: {} },
      });
    }
    return statsNodes;
  }

  private async retrieveAncestors(options: TreeOptions) {
    const ancestors = [];
    const query = new LifecycleQuery({
      schema: options.schema,
      indexPatterns: options.indexPatterns,
      timerange: options.timerange,
    });

    let nodes = options.nodes;
    let numLevelsLeft = options.ancestors;

    while (numLevelsLeft > 0) {
      const results: unknown[] = await query.search(this.client, nodes);
      if (results.length <= 0) {
        return ancestors;
      }

      /**
       * This array (this.ancestry.ancestors) is the accumulated ancestors of the node of interest. This array is different
       * from the ancestry array of a specific document. The order of this array is going to be weird, it will look like this
       * [most distant ancestor...closer ancestor, next recursive call most distant ancestor...closer ancestor]
       *
       * Here is an example of why this happens
       * Consider the following tree:
       * A -> B -> C -> D -> E -> Origin
       * Where A was spawn before B, which was before C, etc
       *
       * Let's assume the ancestry array limit is 2 so Origin's array would be: [E, D]
       * E's ancestry array would be: [D, C] etc
       *
       * If a request comes in to retrieve all the ancestors in this tree, the accumulate results will be:
       * [D, E, B, C, A]
       *
       * The first iteration would retrieve D and E in that order because they are sorted in ascending order by timestamp.
       * The next iteration would get the ancestors of D (since that's the most distant ancestor from Origin) which are
       * [B, C]
       * The next iteration would get the ancestors of B which is A
       * Hence: [D, E, B, C, A]
       */
      ancestors.push(...results);
      numLevelsLeft -= results.length;
      // the results come back in ascending order on timestamp so the first entry in the
      // results should be the furthest ancestor (most distant grandparent)
      nodes = getAncestryAsArray(results[0], options.schema).slice(0, numLevelsLeft);
    }
    return ancestors;
  }

  private async retrieveDescendants(options: TreeOptions): Promise<unknown[]> {
    const descendants: unknown[] = [];
    const query = new DescendantsQuery({
      schema: options.schema,
      indexPatterns: options.indexPatterns,
      timerange: options.timerange,
    });

    let nodes: NodeID[] = options.nodes;
    let numNodesLeftToRequest: number = options.descendants;
    let levelsLeftToRequest: number = options.descendantLevels;
    while (
      numNodesLeftToRequest > 0 &&
      (options.schema.ancestry !== undefined || levelsLeftToRequest > 0)
    ) {
      const results: unknown[] = await query.search(this.client, nodes, numNodesLeftToRequest);
      if (results.length <= 0) {
        return descendants;
      }

      const parents: Set<NodeID> = results.reduce((totalParents: Set<NodeID>, result) => {
        const parentID = getParentField(result, options.schema);
        if (parentID) {
          totalParents.add(parentID);
        }
        return totalParents;
      }, new Set<NodeID>());

      nodes = getLeafNodes(results, nodes, options.schema);

      numNodesLeftToRequest -= results.length;
      levelsLeftToRequest -= parents.size;
      descendants.push(...results);
    }

    return descendants;
  }
}

/**
 * This functions finds the leaf nodes for a given response from an Elasticsearch query.
 *
 * @param results the documents returned from an Elasticsearch query
 * @param nodes an array of unique IDs that were used to find the returned documents
 * @param schema the field definitions for how nodes are represented in the resolver graph
 */
export function getLeafNodes(
  results: unknown[],
  nodes: Array<string | number>,
  schema: Schema
): NodeID[] {
  let largestAncestryArray = 0;
  const nodesToQueryNext: Map<number, Set<NodeID>> = new Map();
  const queriedNodes = new Set<NodeID>(nodes);
  const isDistantGrandchild = (event: unknown) => {
    const ancestry = getAncestryAsArray(event, schema);
    return ancestry.length > 0 && queriedNodes.has(ancestry[ancestry.length - 1]);
  };

  for (const result of results) {
    const ancestry = getAncestryAsArray(result, schema);
    // This is to handle the following unlikely but possible scenario:
    // if an alert was generated by the kernel process (parent process of all other processes) then
    // the direct children of that process would only have an ancestry array of [parent_kernel], a single value in the array.
    // The children of those children would have two values in their array [direct parent, parent_kernel]
    // we need to determine which nodes are the most distant grandchildren of the queriedNodes because those should
    // be used for the next query if more nodes should be retrieved. To generally determine the most distant grandchildren
    // we can use the last entry in the ancestry array because of its ordering. The problem with that is in the scenario above
    // the direct children of parent_kernel will also meet that criteria even though they are not actually the most
    // distant grandchildren. To get around that issue we'll bucket all the nodes by the size of their ancestry array
    // and then only return the nodes in the largest bucket because those should be the most distant grandchildren
    // from the queried nodes that were passed in.
    if (ancestry.length > largestAncestryArray) {
      largestAncestryArray = ancestry.length;
    }

    // a grandchild must have an array of > 0 and have it's last parent be in the set of previously queried nodes
    // this is one of the furthest descendants from the queried nodes
    if (isDistantGrandchild(result)) {
      let levelOfNodes = nodesToQueryNext.get(ancestry.length);
      if (!levelOfNodes) {
        levelOfNodes = new Set<NodeID>();
        nodesToQueryNext.set(ancestry.length, levelOfNodes);
      }
      const nodeID = getIDField(result, schema);
      if (nodeID) {
        levelOfNodes.add(nodeID);
      }
    }
  }
  const nextNodes = nodesToQueryNext.get(largestAncestryArray);

  return nextNodes !== undefined ? Array.from(nextNodes) : [];
}

function getIDField(obj: unknown, schema: Schema): NodeID | undefined {
  return _.get(obj, schema.id);
}

function getParentField(obj: unknown, schema: Schema): NodeID | undefined {
  return _.get(obj, schema.parent);
}

function getAncestryField(obj: unknown, schema: Schema): NodeID[] | undefined {
  if (!schema.ancestry) {
    return undefined;
  }
  return _.get(obj, schema.ancestry);
}

function getAncestryAsArray(obj: unknown, schema: Schema): NodeID[] {
  const ancestry = getAncestryField(obj, schema);
  if (!ancestry) {
    const parentField = getParentField(obj, schema);
    return parentField !== undefined ? [parentField] : [];
  }
  return ancestry;
}
