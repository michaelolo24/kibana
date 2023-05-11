/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { xyz } from 'color';
import path from 'path';

const makePerformanceMark = (markName) => {
  const logFalse = { log: false };

  Cypress.log({
    name: 'mark',
    message: markName,
    consoleProps() {
      return {
        command: 'mark',
        'mark name': markName,
      };
    },
  });

  return cy.window(logFalse).its('performance', logFalse).invoke(logFalse, 'mark', markName);
};

Cypress.Commands.add('makePerformanceMark', makePerformanceMark);

const getMarkPerformance = (markName) => {
  const logFalse = { log: false };
  let measuredDuration;

  const log = Cypress.log({
    name: 'measure',
    message: markName,
    autoEnd: false,
    consoleProps() {
      return {
        command: 'measure',
        'mark name': markName,
        yielded: measuredDuration,
      };
    },
  });

  return cy
    .window(logFalse)
    .its('performance', logFalse)
    .invoke(logFalse, 'measure', markName)
    .then(({ duration }) => {
      measuredDuration = duration;
      log.end();
      return duration;
    });
};

Cypress.Commands.add('getMarkPerformance', getMarkPerformance);

const measureTestPerformance = (shouldDocument = true) => {
  beforeEach(() => {
    const { title } = Cypress.currentTest;
    cy.makePerformanceMark(title);
  });
  afterEach(() => {
    cy.getMarkPerformance(title).then((duration) => {
      const performanceFilePath = 'cypress/performance.json';
      if (shouldDocument) {
        cy.readFile(performanceFilePath).then((testDurations) => {
          testDurations[title] = duration / 1000;
          cy.writeFile(performanceFilePath, JSON.stringify(testDurations, null, 2));
        });
      }
    });
  });
};

Cypress.Commands.add('measureTestPerformance', measureTestPerformance);
