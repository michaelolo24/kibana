/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import type { HomePublicPluginSetup } from '@kbn/home-plugin/public';

export function registerFeature(home: HomePublicPluginSetup) {
  home.featureCatalogue.register({
    id: 'onecases',
    title: i18n.translate('oneCases.oneCasesTitle', {
      defaultMessage: 'One Cases',
    }),
    subtitle: i18n.translate('oneCases.oneCasesSubtitle', {
      defaultMessage: 'Search and find insights.',
    }),
    description: i18n.translate('oneCases.oneCasesDescription', {
      defaultMessage: 'Interactively explore your data by querying and filtering raw documents.',
    }),
    icon: 'casesApp',
    path: '/app/oneCases/',
    showOnHomePage: false,
    category: 'data',
  });
}
