/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrProviderContext } from '../../ftr_provider_context';

export default function ({ getService, getPageObjects }: FtrProviderContext) {
  const a11y = getService('a11y');
  const dashboardPanelActions = getService('dashboardPanelActions');
  const testSubjects = getService('testSubjects');
  const PageObjects = getPageObjects(['common', 'header', 'home']);
  const toasts = getService('toasts');
  const inspector = getService('inspector');

  // Failing: See https://github.com/elastic/kibana/issues/147667
  describe.skip('Dashboard panel options a11y tests', () => {
    const title = '[Flights] Flight count';
    before(async () => {
      await PageObjects.common.navigateToUrl('home', '/tutorial_directory/sampleData', {
        useActualUrl: true,
      });
      await PageObjects.header.waitUntilLoadingHasFinished();
      await PageObjects.home.addSampleDataSet('flights');

      await PageObjects.common.navigateToApp('dashboard');
      await testSubjects.click('dashboardListingTitleLink-[Flights]-Global-Flight-Dashboard');
    });

    after(async () => {
      await PageObjects.common.navigateToUrl('home', '/tutorial_directory/sampleData', {
        useActualUrl: true,
      });
      await PageObjects.home.removeSampleDataSet('flights');
    });

    // dashboard panel options in view mode
    it('dashboard panel - open menu', async () => {
      await dashboardPanelActions.toggleContextMenuByTitle(title);
      await a11y.testAppSnapshot();
      await dashboardPanelActions.toggleContextMenuByTitle(title);
    });

    it('dashboard panel - customize time range', async () => {
      await dashboardPanelActions.toggleContextMenuByTitle(title);
      await testSubjects.click('embeddablePanelAction-CUSTOM_TIME_RANGE');
      await a11y.testAppSnapshot();
      await testSubjects.click('cancelPerPanelTimeRangeButton');
    });

    it('dashboard panel-  inspect', async () => {
      await dashboardPanelActions.openInspectorByTitle('[Flights] Flight count');
      await a11y.testAppSnapshot();
    });

    it('dashboard panel - inspector view chooser ', async () => {
      await testSubjects.click('inspectorViewChooser');
      await a11y.testAppSnapshot();
      await testSubjects.click('inspectorViewChooser');
    });

    it('dashboard panel - inspector request statistics ', async () => {
      await inspector.openInspectorRequestsView();
      await a11y.testAppSnapshot();
    });

    it('dashboard panel - inspector request', async () => {
      await testSubjects.click('inspectorRequestDetailRequest');
      await a11y.testAppSnapshot();
    });

    it('dashboard panel - inspector response', async () => {
      await testSubjects.click('inspectorRequestDetailResponse');
      await a11y.testAppSnapshot();
      await inspector.close();
    });

    it('dashboard panel - maximize', async () => {
      await dashboardPanelActions.clickExpandPanelToggle();
      await a11y.testAppSnapshot();
      await dashboardPanelActions.clickExpandPanelToggle();
    });

    it('dashboard panel - copy to dashboard', async () => {
      await dashboardPanelActions.openContextMenuByTitle(title);
      await testSubjects.click('embeddablePanelAction-copyToDashboard');
      await a11y.testAppSnapshot();
      await testSubjects.click('cancelCopyToButton');
    });

    // dashboard panel options in edit mode

    it('dashboard panel - clone panel', async () => {
      await testSubjects.click('dashboardEditMode');
      await dashboardPanelActions.openContextMenuByTitle(title);
      await testSubjects.click('embeddablePanelAction-clonePanel');
      await toasts.dismissAll();
      await a11y.testAppSnapshot();
    });

    it('dashboard panel - edit panel title', async () => {
      await dashboardPanelActions.customizePanel();
      await a11y.testAppSnapshot();
      await testSubjects.click('customEmbeddablePanelHideTitleSwitch');
      await a11y.testAppSnapshot();
      await testSubjects.click('customEmbeddablePanelHideTitleSwitch');
      await testSubjects.click('saveCustomizePanelButton');
    });

    it('dashboard panel - Create drilldown panel', async () => {
      await dashboardPanelActions.openContextMenuByTitle(title);
      await testSubjects.click('embeddablePanelAction-OPEN_FLYOUT_ADD_DRILLDOWN');
      await a11y.testAppSnapshot();
      await testSubjects.click('actionFactoryItem-DASHBOARD_TO_DASHBOARD_DRILLDOWN');
      await a11y.testAppSnapshot();
      await testSubjects.click('changeDrilldownType');
      await testSubjects.click('actionFactoryItem-URL_DRILLDOWN');
      await a11y.testAppSnapshot();
      await testSubjects.click('changeDrilldownType');
      await testSubjects.click('actionFactoryItem-OPEN_IN_DISCOVER_DRILLDOWN');
      await a11y.testAppSnapshot();
      await testSubjects.click('drilldownWizardSubmit');
    });

    it('dashboard panel - manage drilldown', async () => {
      await dashboardPanelActions.openContextMenuByTitle(title);
      await testSubjects.click('embeddablePanelAction-OPEN_FLYOUT_EDIT_DRILLDOWN');
      await a11y.testAppSnapshot();
      await testSubjects.click('euiFlyoutCloseButton');
    });

    it('dashboard panel - save to library', async () => {
      await dashboardPanelActions.saveToLibrary('', title);
      await a11y.testAppSnapshot();
      await testSubjects.click('saveCancelButton');
    });
  });
}
