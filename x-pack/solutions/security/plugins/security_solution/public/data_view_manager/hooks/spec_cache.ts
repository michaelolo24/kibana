/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { DataViewSpec } from '@kbn/data-views-plugin/common';

// This cache is used to store the DataViewSpec objects to avoid recalculating them
// every time the useDataViewSpec hook is called. This is particularly useful
// when the dataView has a large number of fields, as the toSpec() method can be
// expensive to compute.

// We use a cache here rather that redux because the dataViewSpec is not
// serializable and we don't want to store it in the redux store.
// An alternative could be to store it in context of some sort that is cleared when any 
// dependency changes, but that could be more complex and less performant.
export const dataViewSpecCache = new Map<string, DataViewSpec>();
