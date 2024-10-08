/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { Filter } from '../build_filters';
import { onlyDisabledFiltersChanged } from './only_disabled';

describe('filter manager utilities', () => {
  describe('onlyDisabledFiltersChanged()', () => {
    test('should return true if all filters are disabled', () => {
      const filters = [
        { meta: { disabled: true } },
        { meta: { disabled: true } },
        { meta: { disabled: true } },
      ] as Filter[];
      const newFilters = [{ meta: { disabled: true } }] as Filter[];

      expect(onlyDisabledFiltersChanged(newFilters, filters)).toBe(true);
    });

    test('should return false if there are no old filters', () => {
      const newFilters = [{ meta: { disabled: false } }] as Filter[];

      expect(onlyDisabledFiltersChanged(newFilters, undefined)).toBe(false);
    });

    test('should return false if there are no new filters', () => {
      const filters = [{ meta: { disabled: false } }] as Filter[];

      expect(onlyDisabledFiltersChanged(undefined, filters)).toBe(false);
    });

    test('should return false if all filters are not disabled', () => {
      const filters = [
        { meta: { disabled: false } },
        { meta: { disabled: false } },
        { meta: { disabled: false } },
      ] as Filter[];
      const newFilters = [{ meta: { disabled: false } }] as Filter[];

      expect(onlyDisabledFiltersChanged(newFilters, filters)).toBe(false);
    });

    test('should return false if only old filters are disabled', () => {
      const filters = [
        { meta: { disabled: true } },
        { meta: { disabled: true } },
        { meta: { disabled: true } },
      ] as Filter[];
      const newFilters = [{ meta: { disabled: false } }] as Filter[];

      expect(onlyDisabledFiltersChanged(newFilters, filters)).toBe(false);
    });

    test('should return false if new filters are not disabled', () => {
      const filters = [
        { meta: { disabled: false } },
        { meta: { disabled: false } },
        { meta: { disabled: false } },
      ] as Filter[];
      const newFilters = [{ meta: { disabled: true } }] as Filter[];

      expect(onlyDisabledFiltersChanged(newFilters, filters)).toBe(false);
    });

    test('should return true when all removed filters were disabled', () => {
      const filters = [
        { meta: { disabled: true } },
        { meta: { disabled: true } },
        { meta: { disabled: true } },
      ] as Filter[];
      const newFilters = [] as Filter[];

      expect(onlyDisabledFiltersChanged(newFilters, filters)).toBe(true);
    });

    test('should return false when all removed filters were not disabled', () => {
      const filters = [
        { meta: { disabled: false } },
        { meta: { disabled: false } },
        { meta: { disabled: false } },
      ] as Filter[];
      const newFilters = [] as Filter[];

      expect(onlyDisabledFiltersChanged(newFilters, filters)).toBe(false);
    });

    test('should return true if all changed filters are disabled', () => {
      const filters = [
        { meta: { disabled: true, negate: false } },
        { meta: { disabled: true, negate: false } },
      ] as Filter[];
      const newFilters = [
        { meta: { disabled: true, negate: true } },
        { meta: { disabled: true, negate: true } },
      ] as Filter[];

      expect(onlyDisabledFiltersChanged(newFilters, filters)).toBe(true);
    });

    test('should return false if all filters remove were not disabled', () => {
      const filters = [
        { meta: { disabled: false } },
        { meta: { disabled: false } },
        { meta: { disabled: true } },
      ] as Filter[];
      const newFilters = [{ meta: { disabled: false } }] as Filter[];

      expect(onlyDisabledFiltersChanged(newFilters, filters)).toBe(false);
    });

    test('should return false when all removed filters are not disabled', () => {
      const filters = [
        { meta: { disabled: true } },
        { meta: { disabled: false } },
        { meta: { disabled: true } },
      ] as Filter[];
      const newFilters = [] as Filter[];

      expect(onlyDisabledFiltersChanged(newFilters, filters)).toBe(false);
    });

    test('should not throw with null filters', () => {
      const filters = [null, { meta: { disabled: true } }] as Filter[];
      const newFilters = [] as Filter[];

      expect(() => {
        onlyDisabledFiltersChanged(newFilters, filters);
      }).not.toThrowError();
    });
  });
});
