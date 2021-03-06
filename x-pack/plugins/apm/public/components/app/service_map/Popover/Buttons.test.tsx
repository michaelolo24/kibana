/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { ReactNode } from 'react';
import { Buttons } from './Buttons';
import { render } from '@testing-library/react';
import { MockApmPluginContextWrapper } from '../../../../context/apm_plugin/mock_apm_plugin_context';

function Wrapper({ children }: { children?: ReactNode }) {
  return <MockApmPluginContextWrapper>{children}</MockApmPluginContextWrapper>;
}

describe('Popover Buttons', () => {
  it('renders', () => {
    expect(() =>
      render(<Buttons selectedNodeServiceName="test service name" />, {
        wrapper: Wrapper,
      })
    ).not.toThrowError();
  });

  it('handles focus click', async () => {
    const onFocusClick = jest.fn();
    const result = render(
      <Buttons
        onFocusClick={onFocusClick}
        selectedNodeServiceName="test service name"
      />,
      { wrapper: Wrapper }
    );
    const focusButton = await result.findByText('Focus map');

    focusButton.click();

    expect(onFocusClick).toHaveBeenCalledTimes(1);
  });
});
