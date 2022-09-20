/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useState, useEffect } from 'react';
import { EuiSpacer } from '@elastic/eui';
import { useToasts } from '../../../../common/lib/kibana';
import { CASES_ERROR_TOAST } from '../../../../common/components/event_details/insights/translations';
import { CaseDetailsLink } from '../../../../common/components/links';
import { useKibana } from '../../../../common/lib/kibana/kibana_react';
import { APP_ID } from '../../../../../common/constants';

interface CaseItemProps {
  id: string;
  title: string;
}
type CaseItems = CaseItemProps[];

interface Props {
  eventId: string;
}

const CaseItem = ({ id, title }: CaseItemProps) => {
  return id && title ? (
    <span key={id}>
      {' '}
      <CaseDetailsLink detailName={id} title={title}>
        {title}
      </CaseDetailsLink>
    </span>
  ) : (
    <></>
  );
};

/**
 * Fetches and displays case links of cases that include the associated event (id).
 */
export const AlertCases = React.memo<Props>(({ eventId }) => {
  const {
    services: { cases },
  } = useKibana();
  const toasts = useToasts();

  const [caseList, setCaseList] = useState<CaseItems | []>([]);
  const [hasError, setHasError] = useState<boolean>(false);

  const getRelatedCases = useCallback(async () => {
    let relatedCaseList: CaseItems = [];
    try {
      if (eventId) {
        relatedCaseList =
          (await cases.api.getRelatedCases(eventId, {
            owner: APP_ID,
          })) ?? [];
      }
    } catch (error) {
      setHasError(true);
      toasts.addWarning(CASES_ERROR_TOAST(error));
    }
    setCaseList(relatedCaseList);
  }, [eventId, cases.api, toasts]);

  useEffect(() => {
    getRelatedCases();
  }, [eventId, getRelatedCases]);

  return (
    <>
      {caseList.map((ourCase) => (
        <>
          <CaseItem key={ourCase.id} {...ourCase} />
          <EuiSpacer size="l" />
        </>
      ))}
    </>
  );
});

AlertCases.displayName = 'AlertCases';
