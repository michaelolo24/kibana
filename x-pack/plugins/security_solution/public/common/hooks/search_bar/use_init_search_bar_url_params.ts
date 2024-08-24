/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useDispatch, useSelector } from 'react-redux';
import { useCallback, useMemo } from 'react';
import type { Filter, Query } from '@kbn/es-query';
import { useHistory } from 'react-router-dom';
import { createKbnUrlStateStorage } from '@kbn/kibana-utils-plugin/public';
import { InputsModelId } from '../../store/inputs/constants';
import { useKibana } from '../../lib/kibana';
import { inputsSelectors } from '../../store';
import { inputsActions } from '../../store/inputs';
import { useInitializeUrlParam } from '../../utils/global_query_string';
import { URL_PARAM_KEY } from '../use_url_state';


// TODO: Add type validation checks for the subscription values

export const useInitSearchBarFromUrlParams = () => {
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

  const dispatch = useDispatch();
  const { filterManager, savedQueries } = useKibana().services.data.query;
  const getGlobalFiltersQuerySelector = useMemo(
    () => inputsSelectors.globalFiltersQuerySelector(),
    []
  );
  const filtersFromStore = useSelector(getGlobalFiltersQuerySelector);

  const onInitializeAppQueryFromUrlParam = useCallback(
    (initialState: Query | null) => {
      if (initialState != null) {
        dispatch(
          inputsActions.setFilterQuery({
            id: InputsModelId.global,
            query: initialState.query,
            language: initialState.language,
          })
        );
      }

      const subscription = urlStorage.change$(URL_PARAM_KEY.appQuery).subscribe((value) => {
        dispatch(
          inputsActions.setFilterQuery({
            id: InputsModelId.global,
            query: value.query,
            language: value.language,
          })
        );
      });

      return subscription;
    },
    [dispatch, urlStorage]
  );

  const onInitializeFiltersFromUrlParam = useCallback(
    (initialState: Filter[] | null) => {
      if (initialState != null) {
        filterManager.setFilters(initialState);
        dispatch(
          inputsActions.setSearchBarFilter({
            id: InputsModelId.global,
            filters: initialState,
          })
        );
      } else {
        // Clear app filters and preserve pinned filters. It ensures that other App filters don't leak into security solution.
        filterManager.setAppFilters(filtersFromStore);

        dispatch(
          inputsActions.setSearchBarFilter({
            id: InputsModelId.global,
            filters: filterManager.getFilters(),
          })
        );
      }

      const subscription = urlStorage.change$(URL_PARAM_KEY.filters).subscribe((value) => {
        filterManager.setFilters(value);
        dispatch(
          inputsActions.setSearchBarFilter({
            id: InputsModelId.global,
            filters: value as Filter[],
          })
        );
      });

      return subscription;
    },
    [filterManager, dispatch, filtersFromStore, urlStorage]
  );

  const onInitializeSavedQueryFromUrlParam = useCallback(
    (savedQueryId: string | null) => {
      if (savedQueryId != null && savedQueryId !== '') {
        savedQueries.getSavedQuery(savedQueryId).then((savedQueryData) => {
          const filters = savedQueryData.attributes.filters || [];
          const query = savedQueryData.attributes.query;

          filterManager.setFilters(filters);
          dispatch(
            inputsActions.setSearchBarFilter({
              id: InputsModelId.global,
              filters,
            })
          );

          dispatch(
            inputsActions.setFilterQuery({
              id: InputsModelId.global,
              ...query,
            })
          );
          dispatch(
            inputsActions.setSavedQuery({ id: InputsModelId.global, savedQuery: savedQueryData })
          );
        });
      }

      const subscription = urlStorage.change$(URL_PARAM_KEY.savedQuery).subscribe((value) => {
        if (value != null && value !== '') {
          savedQueries.getSavedQuery(value as string).then((savedQueryData) => {
            const filters = savedQueryData.attributes.filters || [];
            const query = savedQueryData.attributes.query;

            filterManager.setFilters(filters);
            dispatch(
              inputsActions.setSearchBarFilter({
                id: InputsModelId.global,
                filters,
              })
            );

            dispatch(
              inputsActions.setFilterQuery({
                id: InputsModelId.global,
                ...query,
              })
            );
            dispatch(
              inputsActions.setSavedQuery({ id: InputsModelId.global, savedQuery: savedQueryData })
            );
          });
        }
      });

      return subscription;
    },
    [dispatch, filterManager, savedQueries, urlStorage]
  );

  useInitializeUrlParam(URL_PARAM_KEY.appQuery, onInitializeAppQueryFromUrlParam);
  useInitializeUrlParam(URL_PARAM_KEY.filters, onInitializeFiltersFromUrlParam);
  useInitializeUrlParam(URL_PARAM_KEY.savedQuery, onInitializeSavedQueryFromUrlParam);
};
