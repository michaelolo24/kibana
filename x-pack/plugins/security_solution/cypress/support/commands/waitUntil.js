/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

const waitUntil = (subject, fn, options = {}) => {
  const { interval = 200, timeout = 5000 } = options;
  let attempts = Math.floor(timeout / interval);

  const completeOrRetry = (result) => {
    if (result) {
      return result;
    }
    if (attempts < 1) {
      throw new Error(`Timed out while retrying, last result was: {${result}}`);
    }
    cy.wait(interval, { log: false }).then(() => {
      attempts--;
      // eslint-disable-next-line no-use-before-define
      return evaluate();
    });
  };

  const evaluate = () => {
    const result = fn(subject);

    if (result && result.then) {
      return result.then(completeOrRetry);
    } else {
      return completeOrRetry(result);
    }
  };

  return evaluate();
};

Cypress.Commands.add('waitUntil', { prevSubject: 'optional' }, waitUntil);
