/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { MappingProperty, MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';
import type { SavedObject, SavedObjectReference } from '@kbn/core/server';
import {
  CASE_SAVED_OBJECT,
  CASE_USER_ACTION_SAVED_OBJECT,
} from '../../../common/constants';
import { UserActionTypes } from '../../../common/types/domain';
import type { UserActionPersistedAttributes } from '../../common/types/user_actions';
import { createCaseUserActionSavedObjectType } from '../../saved_object_types/user_actions';
import { buildActivityDoc } from '../writer/activity_doc_builder';
import { ACTIVITY_INDEX_MAPPING } from './activity';

/**
 * Schema drift guards for the activity surface — three complementary
 * layers, mirroring the cases-surface guard at `schema_drift.test.ts`.
 *
 * **Layer 1 (buildActivityDoc output ⊆ ACTIVITY_INDEX_MAPPING).** The
 * `.cases-activity` index is mapped `dynamic: 'strict'` — any field a
 * doc-builder emits that isn't in the mapping fails the write with
 * `mapper_parsing_exception`. The writer's `.catch` swallow means that
 * failure is silent: the API succeeds, no doc lands, and the only signal
 * is an ERROR log. This layer round-trips every per-action-type fixture
 * through `buildActivityDoc` and asserts every emitted dotted path
 * resolves in `ACTIVITY_INDEX_MAPPING`.
 *
 * **Layer 2 (per-action-type curated extracts).** Curated extract fields
 * (`action.status_new`, `action.severity_new`, etc.) are populated only
 * for specific action types. A regression where the doc-builder forgets
 * to populate (or types incorrectly) one of these is otherwise invisible
 * — the docs are still well-formed, just missing analytics dimensions.
 * This layer pins the per-type contract so any divergence fails fast.
 *
 * **Layer 3 (SO mapping ⊆ ACTIVITY_INDEX_MAPPING via `cases-user-actions`
 * fields the analytics doc cares about).** Asserts that the small set of
 * SO fields the activity doc consumes (`type`, `action`, `payload`,
 * `created_at`, `created_by`, `owner`) all exist on the SO mapping. The
 * cases SO mapping uses `dynamic: false` for `payload` (per the lesson
 * in §1.4 of the followup PR plan) — we don't expect to mirror payload
 * sub-fields here, but the structural guarantees of the surface fields
 * are still worth pinning.
 */

// ----- Mapping-walking helpers (mirrors cases drift test) -----

const flatten = (doc: unknown, prefix = ''): string[] => {
  if (doc == null || typeof doc !== 'object' || Array.isArray(doc)) {
    return prefix ? [prefix] : [];
  }
  const keys: string[] = [];
  for (const [k, v] of Object.entries(doc as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flatten(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
};

const collectMappedPaths = (mapping: MappingTypeMapping): Set<string> => {
  const out = new Set<string>();
  const walk = (node: Record<string, MappingProperty>, prefix: string): void => {
    for (const [k, prop] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${k}` : k;
      out.add(path);
      const stopAtParent =
        (prop as { enabled?: boolean }).enabled === false ||
        (prop as { dynamic?: boolean | string }).dynamic === true;
      if (!stopAtParent) {
        const props = (prop as { properties?: Record<string, MappingProperty> }).properties;
        if (props) walk(props, path);
      }
    }
  };
  if (mapping.properties) walk(mapping.properties, '');
  return out;
};

const isCovered = (path: string, mappedPaths: Set<string>): boolean => {
  if (mappedPaths.has(path)) return true;
  let p = path;
  while (true) {
    const idx = p.lastIndexOf('.');
    if (idx < 0) break;
    p = p.slice(0, idx);
    if (mappedPaths.has(p)) return true;
  }
  return false;
};

// ----- Per-action-type SO fixtures -----
//
// One fixture per `UserActionType`. Each represents the most realistic
// payload shape that type produces in production — copied from the
// builders at `services/user_actions/builders/*` and the user-action
// type definitions at `common/types/domain/user_action/`. Adding a new
// `UserActionType` without an entry here fails the
// `every-action-type-has-a-fixture` test below.
//
// The fixtures are exhaustive on purpose: the schema drift tests need
// every payload shape to exercise both the curated-extracts code paths
// and the JSON-stringify fallback for unknown payload shapes.

const baseAttrs = {
  action: 'create',
  created_at: '2026-05-01T10:00:00.000Z',
  created_by: { username: 'jane', full_name: 'J', email: 'j@e.com', profile_uid: 'p-1' },
  owner: 'securitySolution',
};

const caseRef: SavedObjectReference = { id: 'case-1', type: CASE_SAVED_OBJECT, name: 'associated-cases' };

const makeUserActionSO = (
  type: string,
  payload: Record<string, unknown>,
  overrides: { action?: string; references?: SavedObjectReference[] } = {}
): SavedObject<UserActionPersistedAttributes> =>
  ({
    type: CASE_USER_ACTION_SAVED_OBJECT,
    id: `ua-${type}`,
    namespaces: ['default'],
    references: overrides.references ?? [caseRef],
    attributes: {
      ...baseAttrs,
      action: overrides.action ?? baseAttrs.action,
      type,
      payload,
    } as UserActionPersistedAttributes,
  } as SavedObject<UserActionPersistedAttributes>);

/** One fixture per UserActionType — keys exhaust the enum. */
const PER_TYPE_FIXTURES: {
  [K in keyof typeof UserActionTypes]: SavedObject<UserActionPersistedAttributes>;
} = {
  title: makeUserActionSO('title', { title: 'Updated title' }, { action: 'update' }),
  description: makeUserActionSO(
    'description',
    { description: 'Updated description' },
    { action: 'update' }
  ),
  status: makeUserActionSO('status', { status: 'in-progress' }, { action: 'update' }),
  severity: makeUserActionSO('severity', { severity: 'high' }, { action: 'update' }),
  tags: makeUserActionSO('tags', { tags: ['p1', 'p2'] }, { action: 'add' }),
  assignees: makeUserActionSO(
    'assignees',
    { assignees: [{ uid: 'u-1' }, { uid: 'u-2' }] },
    { action: 'add' }
  ),
  pushed: makeUserActionSO(
    'pushed',
    {
      externalService: {
        connector_id: 'connector-1',
        connector_name: 'jira',
        external_id: 'JIRA-1',
        external_title: 'Title',
        external_url: 'http://jira',
        pushed_at: '2026-05-01T10:00:00.000Z',
        pushed_by: { username: 'jane', full_name: 'J', email: 'j@e.com', profile_uid: 'p-1' },
      },
    },
    { action: 'push_to_service' }
  ),
  settings: makeUserActionSO(
    'settings',
    { settings: { syncAlerts: true, extractObservables: false } },
    { action: 'update' }
  ),
  comment: makeUserActionSO(
    'comment',
    { comment: { type: 'user', comment: 'A comment', owner: 'securitySolution' } },
    { action: 'create' }
  ),
  connector: makeUserActionSO(
    'connector',
    {
      connector: {
        id: 'connector-1',
        name: 'jira',
        type: '.jira',
        fields: { issueType: '10006', priority: 'High', parent: null },
      },
    },
    { action: 'update' }
  ),
  create_case: makeUserActionSO(
    'create_case',
    {
      title: 'New case',
      description: 'desc',
      tags: [],
      severity: 'low',
      owner: 'securitySolution',
      assignees: [],
      connector: { id: 'none', name: 'none', type: '.none', fields: null },
      settings: { syncAlerts: true },
    },
    { action: 'create' }
  ),
  delete_case: makeUserActionSO('delete_case', {}, { action: 'delete' }),
  category: makeUserActionSO('category', { category: 'malware' }, { action: 'update' }),
  customFields: makeUserActionSO(
    'customFields',
    { customFields: [{ key: 'cf', type: 'text', value: 'x' }] },
    { action: 'update' }
  ),
  observables: makeUserActionSO(
    'observables',
    { observables: { actionType: 'add', count: 1 } },
    { action: 'add' }
  ),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  extended_fields: makeUserActionSO(
    'extended_fields',
    { extended_fields: { score_as_long: '42' } },
    { action: 'update' }
  ),
  template: makeUserActionSO(
    'template',
    { template: { id: 't-1', version: 1 } },
    { action: 'update' }
  ),
};

// ----- Layer 1: doc-builder output ⊆ activity mapping (per-type) -----

describe('activity mapping covers every doc-builder field for every action type', () => {
  const mappedPaths = collectMappedPaths(ACTIVITY_INDEX_MAPPING);

  it.each(Object.entries(PER_TYPE_FIXTURES))(
    'type=%s emits only mapped fields',
    (_type, so) => {
      const doc = buildActivityDoc(so);
      const missing = flatten(doc).filter((p) => !isCovered(p, mappedPaths));
      expect(missing).toEqual([]);
    }
  );
});

// ----- Layer 2: per-action-type curated extracts -----
//
// Each entry pins the curated-extract field(s) the doc-builder MUST
// populate for that action type, and the value(s) it must produce given
// the fixture above. A regression that breaks any extract — silently
// dropping a field, mistyping a value, populating it for the wrong type
// — fails the matching assertion here.

describe('per-action-type curated extracts', () => {
  it('status: populates action.status_new with the new status string', () => {
    const doc = buildActivityDoc(PER_TYPE_FIXTURES.status);
    expect(doc.action.status_new).toBe('in-progress');
  });
  it('severity: populates action.severity_new with the new severity string', () => {
    const doc = buildActivityDoc(PER_TYPE_FIXTURES.severity);
    expect(doc.action.severity_new).toBe('high');
  });
  it('assignees: populates action.assignees_changed with every uid', () => {
    const doc = buildActivityDoc(PER_TYPE_FIXTURES.assignees);
    expect(doc.action.assignees_changed).toEqual(['u-1', 'u-2']);
  });
  it('tags: populates action.tags_changed with every tag', () => {
    const doc = buildActivityDoc(PER_TYPE_FIXTURES.tags);
    expect(doc.action.tags_changed).toEqual(['p1', 'p2']);
  });
  it('connector: populates action.connector_id_new with the new connector instance id', () => {
    const doc = buildActivityDoc(PER_TYPE_FIXTURES.connector);
    expect(doc.action.connector_id_new).toBe('connector-1');
  });
  it('non-extract types do not leak any curated extract field', () => {
    // Spot-check — `description` carries no curated extract, so every
    // optional extract field on `action` should be undefined.
    const doc = buildActivityDoc(PER_TYPE_FIXTURES.description);
    expect(doc.action.status_new).toBeUndefined();
    expect(doc.action.severity_new).toBeUndefined();
    expect(doc.action.assignees_changed).toBeUndefined();
    expect(doc.action.tags_changed).toBeUndefined();
    expect(doc.action.connector_id_new).toBeUndefined();
  });
});

// ----- Layer 3: SO mapping ⊆ activity mapping (surface fields only) -----
//
// The user-actions SO is `dynamic: false` for `payload`, so we don't
// expect to mirror payload sub-fields. The SO surface fields that ARE
// indexed are listed below; each must exist in the SO mapping (so we'd
// notice if upstream renamed `created_by` to `actor` or similar).

const SURFACE_FIELDS_THE_DOC_BUILDER_READS = [
  'type',
  'action',
  'created_at',
  'created_by',
  'owner',
];

describe('SO mapping carries every surface field the activity doc-builder reads', () => {
  const soType = createCaseUserActionSavedObjectType({
    persistableStateAttachmentTypeRegistry: {
      has: () => false,
      get: () => undefined,
      getAll: () => [],
      register: () => undefined,
    } as never,
  } as never);
  const soPaths = collectMappedPaths(soType.mappings as MappingTypeMapping);
  it.each(SURFACE_FIELDS_THE_DOC_BUILDER_READS)('SO mapping has %s', (field) => {
    expect(soPaths.has(field)).toBe(true);
  });
});

// ----- Sanity: every UserActionType has a fixture -----

describe('exhaustiveness', () => {
  it('PER_TYPE_FIXTURES covers every UserActionType', () => {
    const fixtureKeys = new Set(Object.keys(PER_TYPE_FIXTURES));
    const enumKeys = Object.keys(UserActionTypes);
    const missing = enumKeys.filter((k) => !fixtureKeys.has(k));
    // If this fails: a new UserActionType landed in
    // `common/types/domain/user_action/action/v1.ts` without a matching
    // fixture above. Add one before the doc-builder ships.
    expect(missing).toEqual([]);
  });
});
