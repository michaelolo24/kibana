/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ClusterPutComponentTemplateRequest } from '@elastic/elasticsearch/lib/api/types';
import { ENTITY_LATEST_BASE_COMPONENT_TEMPLATE_V1 } from '../../../common/constants_entities';

export const entitiesLatestBaseComponentTemplateConfig: ClusterPutComponentTemplateRequest = {
  name: ENTITY_LATEST_BASE_COMPONENT_TEMPLATE_V1,
  _meta: {
    description:
      "Component template for the ECS fields used in the Elastic Entity Model's entity discovery framework's latest data set",
    documentation: 'https://www.elastic.co/guide/en/ecs/current/ecs-base.html',
    ecs_version: '8.0.0',
    managed: true,
  },
  template: {
    mappings: {
      properties: {
        entity: {
          properties: {
            display_name: {
              type: 'text',
              fields: {
                keyword: {
                  ignore_above: 1024,
                  type: 'keyword',
                },
              },
            },
          },
        },
        labels: {
          type: 'object',
        },
        tags: {
          ignore_above: 1024,
          type: 'keyword',
        },
      },
    },
  },
};
