import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '@emotion/react';
import { useKibana } from '@kbn/security-solution-plugin/public/common/lib/kibana';
import { useEventDetailsFlyoutContext } from '../../context';

// TODO: Add full screen

export const SESSION_VIEW_ID = 'session_view';

export const SessionView = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const { sessionView } = useKibana().services;
  const { searchHit, getFieldsData } = useEventDetailsFlyoutContext();
  const databaseDocumentID = searchHit?._id as string; // Is the eventID - We won't render without this
  const processEntityId = getFieldsData('process.entity_id') as string;
  const sessionEntityId = getFieldsData('process.entry_leader.entity_id') as string;
  const timestamp = (getFieldsData('kibana.alert.original_time') ??
    getFieldsData('@timestamp')) as string;

  if (sessionEntityId === undefined) return null;
  let hasResized = useRef(false);

  const resizeFn = useCallback(() => {
    if (!hasResized.current) {
      if (containerRef.current?.scrollHeight) {
        setHeight(containerRef.current.scrollHeight);
        hasResized.current = true;
      }
    }
  }, []);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.addEventListener('resize', resizeFn)
    }
    return () => {
      containerRef.current?.removeEventListener('resize', resizeFn);
    }
  });
  return (
    <div css={css`height: 100%; min-height: 100%`} ref={containerRef}>
      {sessionView.getSessionView({
        sessionEntityId,
        height,
        jumpToEntityId: processEntityId,
        jumpToCursor: timestamp,
        investigatedAlertId: databaseDocumentID,
        loadAlertDetails: () => {}, // This will be the "Preview loader",
        isFullScreen: false,
        canAccessEndpointManagement: false,
      })}
    </div>
  );
};
