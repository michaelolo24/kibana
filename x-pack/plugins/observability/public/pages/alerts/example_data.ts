/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export const apmAlertResponseExample = [
  {
    'rule.id': ['apm.error_rate'],
    'service.name': ['opbeans-java'],
    'rule.name': ['Error count threshold | opbeans-java (smith test)'],
    'kibana.rac.alert.duration.us': [180057000],
    'kibana.rac.alert.status': ['open'],
    'kibana.rac.alert.severity.level': ['warning'],
    tags: ['apm', 'service.name:opbeans-java'],
    'kibana.rac.alert.uuid': ['0175ec0a-a3b1-4d41-b557-e21c2d024352'],
    'rule.uuid': ['474920d0-93e9-11eb-ac86-0b455460de81'],
    'event.action': ['active'],
    '@timestamp': ['2021-04-12T13:53:49.550Z'],
    'kibana.rac.alert.id': ['apm.error_rate_opbeans-java_production'],
    'kibana.rac.alert.start': ['2021-04-12T13:50:49.493Z'],
    'kibana.rac.producer': ['apm'],
    'event.kind': ['state'],
    'rule.category': ['Error count threshold'],
    'service.environment': ['production'],
    'processor.event': ['error'],
  },
  {
    'rule.id': ['apm.error_rate'],
    'service.name': ['opbeans-java'],
    'rule.name': ['Error count threshold | opbeans-java (smith test)'],
    'kibana.rac.alert.duration.us': [2419005000],
    'kibana.rac.alert.end': ['2021-04-12T13:49:49.446Z'],
    'kibana.rac.alert.status': ['closed'],
    tags: ['apm', 'service.name:opbeans-java'],
    'kibana.rac.alert.uuid': ['32b940e1-3809-4c12-8eee-f027cbb385e2'],
    'rule.uuid': ['474920d0-93e9-11eb-ac86-0b455460de81'],
    'event.action': ['close'],
    '@timestamp': ['2021-04-12T13:49:49.446Z'],
    'kibana.rac.alert.id': ['apm.error_rate_opbeans-java_production'],
    'kibana.rac.alert.start': ['2021-04-12T13:09:30.441Z'],
    'kibana.rac.producer': ['apm'],
    'event.kind': ['state'],
    'rule.category': ['Error count threshold'],
    'service.environment': ['production'],
    'processor.event': ['error'],
  },
];

export const dynamicIndexPattern = {
  fields: [
    {
      name: '@timestamp',
      type: 'date',
      esTypes: ['date'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'event.action',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'event.kind',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'host.name',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'kibana.rac.alert.duration.us',
      type: 'number',
      esTypes: ['long'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'kibana.rac.alert.end',
      type: 'date',
      esTypes: ['date'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'kibana.rac.alert.id',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'kibana.rac.alert.severity.level',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'kibana.rac.alert.severity.value',
      type: 'number',
      esTypes: ['long'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'kibana.rac.alert.start',
      type: 'date',
      esTypes: ['date'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'kibana.rac.alert.status',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'kibana.rac.alert.uuid',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'kibana.rac.producer',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'processor.event',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'rule.category',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'rule.id',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'rule.name',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'rule.uuid',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'service.environment',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'service.name',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'tags',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
    {
      name: 'transaction.type',
      type: 'string',
      esTypes: ['keyword'],
      searchable: true,
      aggregatable: true,
      readFromDocValues: true,
    },
  ],
  timeFieldName: '@timestamp',
  title: '.kibana_smith-alerts-observability*',
};
