/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';
import { either } from 'fp-ts/Either';

export const jsonRt = new t.Type<any, string, unknown>(
  'JSON',
  t.any.is,
  (input, context) =>
    either.chain(t.string.validate(input, context), (str) => {
      try {
        return t.success(JSON.parse(str));
      } catch (e) {
        return t.failure(input, context);
      }
    }),
  (a) => JSON.stringify(a)
);
