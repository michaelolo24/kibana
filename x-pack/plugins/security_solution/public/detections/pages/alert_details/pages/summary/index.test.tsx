/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { AlertSummary } from '.';
import { render } from '@testing-library/react';
import React from 'react';

describe('Alert Summary', () => {
  const { queryAllByText } = render(<AlertSummary />);

  expect(queryAllByText('Summary Page')).toBeInTheDocument();
});
