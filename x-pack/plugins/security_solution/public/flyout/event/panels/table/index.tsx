import { TimelineTabs } from "@kbn/security-solution-plugin/common/types";
import { EventFieldsBrowser } from "@kbn/security-solution-plugin/public/common/components/event_details/event_fields_browser";
import React from "react";
import { BackToAlertDetailsButton } from "../../components/back_to_alert_details";
import { useEventDetailsFlyoutContext } from "../../context";


export const EventTablePanelKey = 'event_table';

export const EventTablePanel: React.FC = React.memo(() => {
    const { browserFields, searchHit, dataFormattedForFieldBrowser } = useEventDetailsFlyoutContext();
    const databaseDocumentID = searchHit?._id as string; // Is
  return browserFields && dataFormattedForFieldBrowser && (
    <div style={{ padding: '20px'}}>
        <BackToAlertDetailsButton />
        <EventFieldsBrowser
            browserFields={browserFields}
            data={dataFormattedForFieldBrowser}
            eventId={databaseDocumentID}
            isDraggable={false}
            timelineTabType={TimelineTabs.query}
            scopeId={'event-flyout'}
            isReadOnly={false}
        />
    </div>
  )
  })
