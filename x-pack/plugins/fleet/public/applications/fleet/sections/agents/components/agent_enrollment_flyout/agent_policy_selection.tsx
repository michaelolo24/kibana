/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState, useEffect } from 'react';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n/react';
import { EuiButtonEmpty, EuiButton, EuiCallOut, EuiSelect, EuiSpacer, EuiText } from '@elastic/eui';

import { SO_SEARCH_LIMIT } from '../../../../constants';
import type { AgentPolicy, GetEnrollmentAPIKeysResponse } from '../../../../types';
import {
  sendGetEnrollmentAPIKeys,
  useStartServices,
  sendCreateEnrollmentAPIKey,
} from '../../../../hooks';
import { AgentPolicyPackageBadges } from '../agent_policy_package_badges';

type Props = {
  agentPolicies?: AgentPolicy[];
  onAgentPolicyChange?: (key?: string) => void;
  excludeFleetServer?: boolean;
} & (
  | {
      withKeySelection: true;
      onKeyChange?: (key?: string) => void;
    }
  | {
      withKeySelection: false;
    }
);

export const EnrollmentStepAgentPolicy: React.FC<Props> = (props) => {
  const { notifications } = useStartServices();
  const { withKeySelection, agentPolicies, onAgentPolicyChange, excludeFleetServer } = props;
  const onKeyChange = props.withKeySelection && props.onKeyChange;

  const [isAuthenticationSettingsOpen, setIsAuthenticationSettingsOpen] = useState(false);
  const [enrollmentAPIKeys, setEnrollmentAPIKeys] = useState<GetEnrollmentAPIKeysResponse['list']>(
    []
  );
  const [isLoadingEnrollmentKey, setIsLoadingEnrollmentKey] = useState(false);

  const [selectedState, setSelectedState] = useState<{
    agentPolicyId?: string;
    enrollmentAPIKeyId?: string;
  }>({});

  useEffect(
    function triggerOnAgentPolicyChangeEffect() {
      if (onAgentPolicyChange) {
        onAgentPolicyChange(selectedState.agentPolicyId);
      }
    },
    [selectedState.agentPolicyId, onAgentPolicyChange]
  );

  useEffect(
    function triggerOnKeyChangeEffect() {
      if (!withKeySelection || !onKeyChange) {
        return;
      }

      if (onKeyChange) {
        onKeyChange(selectedState.enrollmentAPIKeyId);
      }
    },
    [withKeySelection, onKeyChange, selectedState.enrollmentAPIKeyId]
  );

  useEffect(
    function useDefaultAgentPolicyEffect() {
      if (agentPolicies && agentPolicies.length && !selectedState.agentPolicyId) {
        if (agentPolicies.length === 1) {
          setSelectedState({
            ...selectedState,
            agentPolicyId: agentPolicies[0].id,
          });
          return;
        }

        const defaultAgentPolicy = agentPolicies.find((agentPolicy) => agentPolicy.is_default);
        if (defaultAgentPolicy) {
          setSelectedState({
            ...selectedState,
            agentPolicyId: defaultAgentPolicy.id,
          });
        }
      }
    },
    [agentPolicies, selectedState]
  );

  useEffect(
    function useEnrollmentKeysForAgentPolicyEffect() {
      if (!withKeySelection) {
        return;
      }
      if (!selectedState.agentPolicyId) {
        setIsAuthenticationSettingsOpen(true);
        setEnrollmentAPIKeys([]);
        return;
      }

      async function fetchEnrollmentAPIKeys() {
        try {
          const res = await sendGetEnrollmentAPIKeys({
            page: 1,
            perPage: SO_SEARCH_LIMIT,
          });
          if (res.error) {
            throw res.error;
          }

          if (!res.data) {
            throw new Error('No data while fetching enrollment API keys');
          }

          setEnrollmentAPIKeys(
            res.data.list.filter(
              (key) => key.policy_id === selectedState.agentPolicyId && key.active === true
            )
          );
        } catch (error) {
          notifications.toasts.addError(error, {
            title: 'Error',
          });
        }
      }
      fetchEnrollmentAPIKeys();
    },
    [withKeySelection, selectedState.agentPolicyId, notifications.toasts]
  );

  useEffect(
    function useDefaultEnrollmentKeyForAgentPolicyEffect() {
      if (!withKeySelection) {
        return;
      }
      if (
        !selectedState.enrollmentAPIKeyId &&
        enrollmentAPIKeys.length > 0 &&
        enrollmentAPIKeys[0].policy_id === selectedState.agentPolicyId
      ) {
        const enrollmentAPIKeyId = enrollmentAPIKeys[0].id;
        setSelectedState({
          agentPolicyId: selectedState.agentPolicyId,
          enrollmentAPIKeyId,
        });
      }
    },
    [
      withKeySelection,
      enrollmentAPIKeys,
      selectedState.enrollmentAPIKeyId,
      selectedState.agentPolicyId,
    ]
  );

  return (
    <>
      <EuiSelect
        fullWidth
        prepend={
          <EuiText>
            <FormattedMessage
              id="xpack.fleet.enrollmentStepAgentPolicy.policySelectLabel"
              defaultMessage="Agent policy"
            />
          </EuiText>
        }
        isLoading={!agentPolicies}
        options={(agentPolicies || []).map((agentPolicy) => ({
          value: agentPolicy.id,
          text: agentPolicy.name,
        }))}
        value={selectedState.agentPolicyId || undefined}
        onChange={(e) =>
          setSelectedState({
            agentPolicyId: e.target.value,
            enrollmentAPIKeyId: undefined,
          })
        }
        aria-label={i18n.translate('xpack.fleet.enrollmentStepAgentPolicy.policySelectAriaLabel', {
          defaultMessage: 'Agent policy',
        })}
      />
      <EuiSpacer size="m" />
      {selectedState.agentPolicyId && (
        <AgentPolicyPackageBadges
          agentPolicyId={selectedState.agentPolicyId}
          excludeFleetServer={excludeFleetServer}
        />
      )}
      {withKeySelection && onKeyChange && (
        <>
          <EuiSpacer size="m" />
          <EuiButtonEmpty
            flush="left"
            iconType={isAuthenticationSettingsOpen ? 'arrowDown' : 'arrowRight'}
            onClick={() => setIsAuthenticationSettingsOpen(!isAuthenticationSettingsOpen)}
          >
            <FormattedMessage
              id="xpack.fleet.enrollmentStepAgentPolicy.showAuthenticationSettingsButton"
              defaultMessage="Authentication settings"
            />
          </EuiButtonEmpty>
          {isAuthenticationSettingsOpen && (
            <>
              <EuiSpacer size="m" />
              {enrollmentAPIKeys.length && selectedState.enrollmentAPIKeyId ? (
                <EuiSelect
                  fullWidth
                  options={enrollmentAPIKeys.map((key) => ({
                    value: key.id,
                    text: key.name,
                  }))}
                  value={selectedState.enrollmentAPIKeyId || undefined}
                  prepend={
                    <EuiText>
                      <FormattedMessage
                        id="xpack.fleet.enrollmentStepAgentPolicy.enrollmentTokenSelectLabel"
                        defaultMessage="Enrollment token"
                      />
                    </EuiText>
                  }
                  onChange={(e) => {
                    setSelectedState({
                      ...selectedState,
                      enrollmentAPIKeyId: e.target.value,
                    });
                  }}
                />
              ) : (
                <EuiCallOut
                  color="warning"
                  title={i18n.translate(
                    'xpack.fleet.enrollmentStepAgentPolicy.noEnrollmentTokensForSelectedPolicyCallout',
                    {
                      defaultMessage:
                        'There are no enrollment tokens for the selected agent policy',
                    }
                  )}
                >
                  <div className="eui-textBreakWord">
                    <FormattedMessage
                      id="xpack.fleet.agentEnrenrollmentStepAgentPolicyollment.noEnrollmentTokensForSelectedPolicyCalloutDescription"
                      defaultMessage="You must create and enrollment token in order to enroll agents with this policy"
                    />
                  </div>
                  <EuiSpacer size="m" />
                  <EuiButton
                    iconType="plusInCircle"
                    isLoading={isLoadingEnrollmentKey}
                    fill
                    onClick={() => {
                      setIsLoadingEnrollmentKey(true);
                      if (selectedState.agentPolicyId) {
                        sendCreateEnrollmentAPIKey({ policy_id: selectedState.agentPolicyId })
                          .then((res) => {
                            if (res.error) {
                              throw res.error;
                            }
                            setIsLoadingEnrollmentKey(false);
                            if (res.data?.item) {
                              setEnrollmentAPIKeys([res.data.item]);
                              setSelectedState({
                                ...selectedState,
                                enrollmentAPIKeyId: res.data.item.id,
                              });
                              notifications.toasts.addSuccess(
                                i18n.translate('xpack.fleet.newEnrollmentKey.keyCreatedToasts', {
                                  defaultMessage: 'Enrollment token created',
                                })
                              );
                            }
                          })
                          .catch((error) => {
                            setIsLoadingEnrollmentKey(false);
                            notifications.toasts.addError(error, {
                              title: 'Error',
                            });
                          });
                      }
                    }}
                  >
                    <FormattedMessage
                      id="xpack.fleet.enrollmentStepAgentPolicy.setUpAgentsLink"
                      defaultMessage="Create enrollment token"
                    />
                  </EuiButton>
                </EuiCallOut>
              )}
            </>
          )}
        </>
      )}
    </>
  );
};
