/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import type { EuiPageHeaderProps, EuiPageTemplateProps } from '@elastic/eui';
import { EuiButton, EuiPageTemplate } from '@elastic/eui';
import { YamlEditor } from './components/yaml_editor';

const panelled: EuiPageTemplateProps['panelled'] = undefined;
const restrictWidth: EuiPageTemplateProps['restrictWidth'] = false;
const bottomBorder: EuiPageTemplateProps['bottomBorder'] = 'extended';

export const TemplateApp = () => {
  const [selectedTabLabel, setSelectedTabLabel] = useState('Templates');

  const isSelected = (tabLabel: string) => selectedTabLabel === tabLabel;
  const tabs: EuiPageHeaderProps['tabs'] = [
    {
      label: 'Templates',
      disabled: false,
      onClick: () => setSelectedTabLabel('Templates'),
      isSelected: isSelected('Templates'),
    },
    {
      label: 'Fields',
      disabled: false,
      onClick: () => setSelectedTabLabel('Fields'),
      isSelected: isSelected('Fields'),
    },
  ];
  return (
    <EuiPageTemplate
      panelled={panelled}
      restrictWidth={restrictWidth}
      bottomBorder={bottomBorder}
      offset={0}
      grow={true}
    >
      <EuiPageTemplate.Header
        iconType="logoElastic"
        pageTitle="Templates"
        rightSideItems={[<EuiButton>Right side item</EuiButton>]}
        description="Build templates for cases or chat applications"
        tabs={tabs}
      />
      {isSelected('Templates') && <YamlEditor value="" schemas={[]} onChange={() => {}} />}
      {isSelected('Fields') && <div>Fields Page</div>}
    </EuiPageTemplate>
  );
};
