import { EuiButtonEmpty } from "@elastic/eui"
import React, { useCallback } from "react"
import { useEventDetailsFlyoutContext } from "../context";
import { EventDetailsPanelKey } from "../panels/event";

export const BackToAlertDetailsButton = () => {
    const { updateExpandableFlyoutConfig } = useEventDetailsFlyoutContext();
    const onClick = useCallback(() =>
    updateExpandableFlyoutConfig({
      right: { id: EventDetailsPanelKey },
    }), []);
    return (
        <EuiButtonEmpty onClick={onClick} iconType="arrowLeft">
            Back to alert details
        </EuiButtonEmpty>
    )
}