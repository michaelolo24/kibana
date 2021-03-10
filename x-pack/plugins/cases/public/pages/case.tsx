/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';

import { AllCases } from '../components/all_cases';
import { savedObjectReadOnlyErrorMessage, CaseCallOut } from '../components/callout';

// TODO: Potentially rename to AllCases?
export interface CasesPageProps {
  userPermissions: {
    crud: boolean;
    read: boolean;
  };
}

export const CasesPage = React.memo(({ userPermissions }: CasesPageProps) => (
  <>
    {userPermissions != null && !userPermissions?.crud && userPermissions?.read && (
      <CaseCallOut
        title={savedObjectReadOnlyErrorMessage.title}
        messages={[{ ...savedObjectReadOnlyErrorMessage }]}
      />
    )}
    <AllCases userCanCrud={userPermissions?.crud ?? false} />
  </>
));

CasesPage.displayName = 'CasesPage';
