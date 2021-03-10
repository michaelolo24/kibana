/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { CoreStart, CoreSetup, Plugin, PluginInitializerContext } from 'src/core/public';
import { TestComponent } from '.';
import { CasesPage, CasesPageProps } from './pages/case';

export interface CasesUiStart {
  casesComponent: () => JSX.Element;
  casesPage: React.MemoExoticComponent<({ userPermissions }: CasesPageProps) => JSX.Element>;
}

export class CasesUiPlugin implements Plugin<void, CasesUiStart> {
  private readonly casesUi = {} as CasesUiStart;

  constructor(initializerContext: PluginInitializerContext) {}

  public setup(core: CoreSetup): void {
    this.casesUi.casesComponent = TestComponent;
    this.casesUi.casesPage = CasesPage;
  }

  public start(core: CoreStart): CasesUiStart {
    return this.casesUi;
  }

  public stop() {}
}
