/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { AllCasesList } from './all_cases_list';
import { CasesPageShell } from './cases_page_shell';

export const AllCases: React.FC = () => (
  <CasesPageShell>
    <AllCasesList />
  </CasesPageShell>
);
AllCases.displayName = 'AllCases';

// eslint-disable-next-line import/no-default-export
export { AllCases as default };
