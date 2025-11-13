/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import type { AppUpdater, PluginInitializerContext } from '@kbn/core/public';
import {
  DEFAULT_APP_CATEGORIES,
  type AppMountParameters,
  type CoreSetup,
  type CoreStart,
  type Plugin,
} from '@kbn/core/public';
import type { DeveloperExamplesSetup } from '@kbn/developer-examples-plugin/public';
import type { HomePublicPluginSetup } from '@kbn/home-plugin/public';
import { BehaviorSubject } from 'rxjs';
import { registerFeature } from './plugin_imports/register_feature';
import { renderApp } from './application';
interface SetupDeps {
  developerExamples: DeveloperExamplesSetup;
  home?: HomePublicPluginSetup;
}
export class OneCasesPlugin implements Plugin<void, void, SetupDeps> {
  private appStateUpdater = new BehaviorSubject<AppUpdater>(() => ({}));
  constructor(private initializerContext: PluginInitializerContext) {}

  public setup(core: CoreSetup, deps: SetupDeps) {
    // Register an application into the side navigation menu
    core.application.register({
      id: 'onecases',
      title: 'One Cases',
      order: 7000,
      euiIconType: 'logoKibana',
      category: DEFAULT_APP_CATEGORIES.kibana,
      defaultPath: '#/',
      updater$: this.appStateUpdater.asObservable(),
      visibleIn: ['globalSearch', 'sideNav', 'kibanaOverview'],
      mount: renderApp,
    });
    if (deps.home) {
      registerFeature(deps.home);
    }
  }
  public start(core: CoreStart) {
    return {};
  }
  public stop() {}
}
