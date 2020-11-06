/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { Dispatch, MiddlewareAPI } from 'redux';
import _ from 'lodash';
import {
  ResolverTree,
  ResolverEntityIndex,
  GraphResponse,
  ResolverGraphNode,
  ResolverGraphData,
} from '../../../../common/endpoint/types';
import { ResolverState, DataAccessLayer, NodeIdSchema } from '../../types';
import * as selectors from '../selectors';
import { ResolverAction } from '../actions';
/**
 * A function that handles syncing ResolverTree data w/ the current entity ID.
 * This will make a request anytime the entityID changes (to something other than undefined.)
 * If the entity ID changes while a request is in progress, the in-progress request will be cancelled.
 * Call the returned function after each state transition.
 * This is a factory because it is stateful and keeps that state in closure.
 */

// const get = (obj: unknown, path: string | string[], defValue?: unknown) => {
//   // If path is not defined or it has false value
//   if (!path) return undefined;
//   if (typeof obj !== 'object') return undefined;
//   // This regex breaks down the path into an array
//   // So if the object is { a: [{ b: 'answer' }] } and the path is a[0].b it would return ['a', '0', 'b'];
//   const pathArray: string[] = Array.isArray(path) ? path : path.match(/([^[.\]])+/g);
//   // Find value if exist return otherwise return undefined value;
//   return (
//     // TODO: Fix type issue or just use lodash.get instead of // https://youmightnotneed.com/lodash/
//     // @ts-ignore
//     pathArray.reduce((prevObj, key) => prevObj && prevObj[key], obj) || defValue
//   );
// };

// TODO: Move this logic to the backend to convert this to 'graph' format?
const convertDataToResolverGraphFormat = (
  data: GraphResponse[],
  schema: NodeIdSchema
): ResolverGraphNode[] => {
  return data.reduce((resolverNodes: ResolverGraphNode[], current: GraphResponse) => {
    const nodeId: string = _.get(current.data, schema.id);
    const connection: string = _.get(current.data, schema.parent);

    if (!nodeId || typeof nodeId !== 'string') return resolverNodes;
    if (!connection || typeof connection !== 'string') return resolverNodes;

    resolverNodes.push({
      ...current,
      nodeId,
      connections: [connection],
    });

    return resolverNodes;
  }, []);
};

export function ResolverTreeFetcher(
  dataAccessLayer: DataAccessLayer,
  api: MiddlewareAPI<Dispatch<ResolverAction>, ResolverState>
): () => void {
  let lastRequestAbortController: AbortController | undefined;

  // Call this after each state change.
  // This fetches the ResolverTree for the current entityID
  // if the entityID changes while
  return async () => {
    const state = api.getState();
    const databaseParameters = selectors.treeParametersToFetch(state);

    // TODO: Wire up selector to get id and parent information from user-input or timeline
    const timerange = { from: '2020-11-05T14:55:46.308Z', to: '2020-11-06T14:55:46.308Z' };
    const schema = { id: 'process.entity_id', parent: 'process.parent.entity_id' };
    // const schema = {
    //   id: 'process.entity_id',
    //   parent: 'process.parent.entity_id',
    //   ancestry: 'process.Ext.ancestry',
    // };

    // TODO: Discuss whether or not we want to hardcode this in the front end for now or backend....

    // const schemas = {
    //   winlog: { id: 'process.entity_id', parent: 'process.parent.entitiy_id' },
    //   endpoint: { id: 'process.entity_id', parent: 'process.parent.entitiy_id' },
    //   packetbeat: { id: 'something', parent: 'something' },
    // };

    let entityIDToFetch: string | undefined;

    if (selectors.treeRequestParametersToAbort(state) && lastRequestAbortController) {
      lastRequestAbortController.abort();
      // calling abort will cause an action to be fired
    } else if (databaseParameters !== null) {
      lastRequestAbortController = new AbortController();
      let result: ResolverTree | undefined;
      let graphResult: GraphResponse[] | undefined;
      // Inform the state that we've made the request. Without this, the middleware will try to make the request again
      // immediately.
      api.dispatch({
        type: 'appRequestedResolverData',
        payload: databaseParameters,
      });
      try {
        // TODO: Update the entities for the front end to explicitly send what fields to return based on data source
        const matchingEntities: ResolverEntityIndex = await dataAccessLayer.entities({
          _id: databaseParameters.databaseDocumentID,
          indices: databaseParameters.indices ?? [],
          signal: lastRequestAbortController.signal,
        });
        if (matchingEntities.length < 1) {
          // If no entity_id could be found for the _id, bail out with a failure.
          api.dispatch({
            type: 'serverFailedToReturnResolverData',
            payload: databaseParameters,
          });
          return;
        }
        entityIDToFetch = matchingEntities[0].entity_id;

        result = await dataAccessLayer.resolverTree(
          entityIDToFetch,
          lastRequestAbortController.signal
        );

        graphResult = await dataAccessLayer.resolverGraph(
          entityIDToFetch,
          schema,
          timerange,
          databaseParameters.indices ?? []
        );

        // console.log('RESULT: ', JSON.stringify(result, null, 2));
        // console.log('SAMPLE RESULT: ', JSON.stringify(graphResult, null, 2));
      } catch (error) {
        // https://developer.mozilla.org/en-US/docs/Web/API/DOMException#exception-AbortError
        if (error instanceof DOMException && error.name === 'AbortError') {
          api.dispatch({
            type: 'appAbortedResolverDataRequest',
            payload: databaseParameters,
          });
        } else {
          api.dispatch({
            type: 'serverFailedToReturnResolverData',
            payload: databaseParameters,
          });
        }
      }
      if (graphResult !== undefined) {
        const resolverGraphData: ResolverGraphData = {
          // TODO: Get backend to send back nodeOrigin to replace this field and do the conversion on the backend?
          originId: entityIDToFetch,
          graph: convertDataToResolverGraphFormat(graphResult, schema),
        };
        if (entityIDToFetch) {
          resolverGraphData.originId = entityIDToFetch;
        }
        console.log("RESULT: ", JSON.stringify(resolverGraphData, null, 2)); // eslint-disable-line

        api.dispatch({
          type: 'serverReturnedResolverData',
          payload: {
            result: resolverGraphData,
            parameters: databaseParameters,
          },
        });
      }
    }
  };
}
