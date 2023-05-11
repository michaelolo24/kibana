/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import 'cypress-file-upload';

const attachFile = (input, fileName, fileType = 'text/plain') => {
  cy.fixture(fileName).then((content) => {
    const blob = Cypress.Blob.base64StringToBlob(btoa(content), fileType);
    const testFile = new File([blob], fileName, { type: fileType });
    const dataTransfer = new DataTransfer();

    dataTransfer.items.add(testFile);
    input[0].files = dataTransfer.files;
    return input;
  });
};

Cypress.Commands.add('attachFile', { prevSubject: 'element' }, attachFile);
