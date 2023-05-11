/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

const getSuiteDescribeTitle = () => Cypress.currentTest.titlePath[0];
const performanceFilePath = 'cypress/performance_by_describe.json';

export const testSuitePerformance = (enabled = true) => {
  if (enabled) {
    let cumulativeItBlockDuration = 0;
    let currentTime = new Date().getTime();

    before(() => {
      cumulativeItBlockDuration = 0;
      currentTime = new Date().getTime();
    });

    beforeEach(() => {
      const suiteTitle = getSuiteDescribeTitle();
      cy.makePerformanceMark(suiteTitle);
    });

    afterEach(() => {
      const suiteTitle = getSuiteDescribeTitle();
      cy.getMarkPerformance(suiteTitle).then((blockDuration) => {
        cumulativeItBlockDuration += blockDuration / 1000;
      });
    });

    after(() => {
      const finalTime = new Date().getTime();
      const overallTime = (finalTime - currentTime) / 1000;
      cy.readFile(performanceFilePath).then((performanceJson) => {
        performanceJson[getSuiteDescribeTitle()] = {
          cumulativeItBlockDuration,
          overallTime,
        };
        const formattedJSON = JSON.stringify(performanceJson, null, 2);
        cy.writeFile(performanceFilePath, formattedJSON);
      });
    });
  }
};
