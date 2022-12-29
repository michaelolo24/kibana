import { ExpandableFlyoutProps } from "@kbn/security-solution-plugin/public/common/components/expandable_flyout";
import React from "react";
import { EventDetailsPanel, EventDetailsPanelKey } from "./event";
import { EventTablePanel, EventTablePanelKey } from "./table";
import { EventVisualizePanelKey, EventVisualizePanel } from "./visualize";

// TODO: potentially pass as a hook to be able to warn the dev of a dupicate key
export const expandableFlyoutPanels: ExpandableFlyoutProps['panels'] = [
    {
      sectionId: EventDetailsPanelKey,
      size: 550,
      component: <EventDetailsPanel />,
    },
    {
      sectionId: EventVisualizePanelKey,
      size: 1000,
      component: <EventVisualizePanel />,
    },
    {
      sectionId: EventTablePanelKey,
      size: 550,
      component: <EventTablePanel />
    }
  ];
