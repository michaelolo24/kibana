/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createKbnUrlStateStorage } from '@kbn/kibana-utils-plugin/public';
import { isEqual } from 'lodash';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Subscription } from 'rxjs';
import { useHistory } from 'react-router-dom';
import { APP_ID } from '../../../common';
import { URL_PARAM_KEY } from './use_url_state';

type UrlKey = keyof typeof URL_PARAM_KEY;

export type UrlUpdates = Record<UrlKey, unknown>;
interface UrlMessageEvent {
  data: UrlUpdates;
}

export const useBroadcastChannel = () => {
  const prevStateValues = useRef<Partial<UrlUpdates> | null>(null);
  const subscriptions = useRef<Subscription[]>([]);
  const blackListUrlKeys = useMemo<UrlKey[]>(
    () => [URL_PARAM_KEY.flyout, URL_PARAM_KEY.timelineFlyout],
    []
  );

  const history = useHistory();

  const urlStorage = useMemo(
    () =>
      createKbnUrlStateStorage({
        history,
        useHash: false,
        useHashQuery: false,
      }),
    [history]
  );

  const getCurrentStateValues = useCallback(() => {
    const currentStateValues = prevStateValues.current;
    if (currentStateValues !== null) {
      return currentStateValues;
    }
    const urlParamKeys = Object.keys(URL_PARAM_KEY).filter(
      (key) => !blackListUrlKeys?.includes(key)
    ) as UrlKey[];

    const initStateValues: Partial<UrlUpdates> = {};

    urlParamKeys.forEach((urlParamKey) => {
      const currentValue = urlStorage.get(urlParamKey);
      initStateValues[urlParamKey] = currentValue;
    });
    prevStateValues.current = initStateValues;
    return initStateValues;
  }, [blackListUrlKeys, urlStorage]);

  const channel = useMemo(() => new BroadcastChannel(APP_ID), []);

  channel.onmessage = (messageEvent: UrlMessageEvent) => {
    if (messageEvent.data) {
      const urlUpdates = messageEvent.data;
      (Object.keys(urlUpdates) as UrlKey[]).forEach((urlParamKey) => {
        if (blackListUrlKeys?.includes(urlParamKey)) return;
        const update = urlUpdates[urlParamKey];
        urlStorage.set(urlParamKey, update);
      });
    }
  };

  useEffect(() => {
    const urlParamKeys = Object.keys(URL_PARAM_KEY) as UrlKey[];

    urlParamKeys.forEach((urlParamKey) => {
      if (blackListUrlKeys?.includes(urlParamKey)) return;
      const subscription = urlStorage.change$(urlParamKey).subscribe((value) => {
        const prevValue = getCurrentStateValues()[urlParamKey];
        if (!isEqual(value, prevValue)) {
          prevStateValues.current = {
            ...structuredClone(prevStateValues.current),
            [urlParamKey]: value,
          };
          channel.postMessage({ [urlParamKey]: value });
        }
      });
      subscriptions.current.push(subscription);
    });

    const activeSubscriptions = subscriptions.current;
    return () => {
      activeSubscriptions.forEach((subscription) => subscription.unsubscribe());
      channel.close();
    };
  }, [blackListUrlKeys, channel, getCurrentStateValues, urlStorage]);
};
