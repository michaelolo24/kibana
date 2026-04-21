/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import { CasesDeepLinkId } from '../../common/navigation';
import { useGetActionLicense } from '../../containers/use_get_action_license';
import { CaseCallouts } from '../callouts/case_callouts';
import { useCasesBreadcrumbs } from '../use_breadcrumbs';
import { getActionLicenseError } from '../use_push_to_service/helpers';
import { useKibana } from '../../common/lib/kibana';
import { CasesTableHeader } from './header';

/**
 * Shared top-of-page shell for the Cases home view. Renders breadcrumbs, license callouts
 * and the table header (with the primary "Create case" action). Consumed by both
 * `<AllCases />` (flag-off path) and `<CasesHomeTabs />` (flag-on path) so the two paths
 * can never visually drift.
 */
export const CasesPageShell: React.FC<{ children: React.ReactNode }> = React.memo(
  ({ children }) => {
    useCasesBreadcrumbs(CasesDeepLinkId.cases);

    const { docLinks } = useKibana().services;
    const { data: actionLicense = null } = useGetActionLicense();
    const actionsErrors = useMemo(
      () => getActionLicenseError(actionLicense, docLinks),
      [actionLicense, docLinks]
    );

    return (
      <>
        <CaseCallouts />
        <CasesTableHeader actionsErrors={actionsErrors} />
        {children}
      </>
    );
  }
);
CasesPageShell.displayName = 'CasesPageShell';
