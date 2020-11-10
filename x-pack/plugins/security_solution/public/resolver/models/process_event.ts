/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { ResolverGraphNode } from './../../../common/endpoint/types/index';
import { firstNonNullValue } from '../../../common/endpoint/models/ecs_safety_helpers';

import * as eventModel from '../../../common/endpoint/models/event';
import { ResolverEvent, SafeResolverEvent } from '../../../common/endpoint/types';
import { ResolverProcessType } from '../types';

/**
 * Returns true if the process's eventType is either 'processCreated' or 'processRan'.
 * Resolver will only render 'graphable' process events.
 */
export function isGraphableProcess(passedEvent: SafeResolverEvent) {
  return eventType(passedEvent) === 'processCreated' || eventType(passedEvent) === 'processRan';
}

export function isTerminatedProcess(passedEvent: SafeResolverEvent) {
  return eventType(passedEvent) === 'processTerminated';
}

/**
 * ms since Unix epoc, based on timestamp.
 * may return NaN if the timestamp wasn't present or was invalid.
 */
export function datetime(passedEvent: SafeResolverEvent): number | null {
  const timestamp = eventModel.timestampSafeVersion(passedEvent);

  const time = timestamp === undefined ? 0 : new Date(timestamp).getTime();

  // if the date could not be parsed, return null
  return isNaN(time) ? null : time;
}

/**
 * Returns a custom event type for a process event based on the event's metadata.
 */
export function eventType(passedEvent: SafeResolverEvent): ResolverProcessType {
  if (eventModel.isLegacyEventSafeVersion(passedEvent)) {
    const {
      endgame: { event_type_full: type, event_subtype_full: subType },
    } = passedEvent;

    if (type === 'process_event') {
      if (subType === 'creation_event' || subType === 'fork_event' || subType === 'exec_event') {
        return 'processCreated';
      } else if (subType === 'already_running') {
        return 'processRan';
      } else if (subType === 'termination_event') {
        return 'processTerminated';
      } else {
        return 'unknownProcessEvent';
      }
    } else if (type === 'alert_event') {
      return 'processCausedAlert';
    }
  } else {
    const type = new Set(eventModel.eventType(passedEvent));
    const category = new Set(eventModel.eventCategory(passedEvent));
    const kind = new Set(eventModel.eventKind(passedEvent));
    if (category.has('process')) {
      if (type.has('start') || type.has('change') || type.has('creation')) {
        return 'processCreated';
      } else if (type.has('info')) {
        return 'processRan';
      } else if (type.has('end')) {
        return 'processTerminated';
      } else {
        return 'unknownProcessEvent';
      }
    } else if (kind.has('alert')) {
      return 'processCausedAlert';
    }
  }
  return 'unknownEvent';
}

/**
 * Returns the process event's PID
 */
export function uniquePidForProcess(passedEvent: ResolverEvent): string {
  if (eventModel.isLegacyEvent(passedEvent)) {
    return String(passedEvent.endgame.unique_pid);
  } else {
    return passedEvent.process.entity_id;
  }
}

/**
 * Returns the PID for the process on the host
 */
export function processPID(event: SafeResolverEvent): number | undefined {
  return firstNonNullValue(
    eventModel.isLegacyEventSafeVersion(event) ? event.endgame.pid : event.process?.pid
  );
}

/**
 * Returns the process event's parent PID
 */
export function uniqueParentPidForProcess(passedEvent: ResolverEvent): string | undefined {
  if (eventModel.isLegacyEvent(passedEvent)) {
    return String(passedEvent.endgame.unique_ppid);
  } else {
    return passedEvent.process.parent?.entity_id;
  }
}

/**
 * Returns the process event's path on its host
 */
export function processPath(passedEvent: SafeResolverEvent): string | undefined {
  return firstNonNullValue(
    eventModel.isLegacyEventSafeVersion(passedEvent)
      ? passedEvent.endgame.process_path
      : passedEvent.process?.executable
  );
}

/**
 * Returns the username for the account that ran the process
 */
export function userInfoForProcess(
  passedEvent: ResolverEvent
): { name?: string; domain?: string } | undefined {
  return passedEvent.user;
}

/**
 * Returns the command line path and arguments used to run the `passedEvent` if any
 *
 * @param {ResolverEvent} passedEvent The `ResolverEvent` to get the arguments value for
 * @returns {string | undefined} The arguments (including the path) used to run the process
 */
export function argsForProcess(passedEvent: ResolverEvent): string | undefined {
  if (eventModel.isLegacyEvent(passedEvent)) {
    // There is not currently a key for this on Legacy event types
    return undefined;
  }
  return passedEvent?.process?.args;
}

/**
 * used to sort events
 * @deprecated - use orderNodesByProperty
 */
export function orderByTime(first: SafeResolverEvent, second: SafeResolverEvent): number {
  const firstDatetime: number | null = datetime(first);
  const secondDatetime: number | null = datetime(second);

  if (firstDatetime === secondDatetime) {
    // break ties using an arbitrary (stable) comparison of `eventId` (which should be unique)
    return String(eventModel.eventIDSafeVersion(first)).localeCompare(
      String(eventModel.eventIDSafeVersion(second))
    );
  } else if (firstDatetime === null || secondDatetime === null) {
    // sort `null`'s as higher than numbers
    return (firstDatetime === null ? 1 : 0) - (secondDatetime === null ? 1 : 0);
  } else {
    // sort in ascending order.
    return firstDatetime - secondDatetime;
  }
}

/**
 * This function allows the graph to be sorted based on a property within the data bucket.
 * If the field needs to be modified before comparison, an optional modifier can be provided.
 * TODO: make sure this is stable
 */
export function orderGraphNodesByProperty(
  firstValue: ResolverGraphNode['data'],
  secondValue: ResolverGraphNode['data'],
  property: string,
  modifier?: Function
): number {
  // TODO: You would probably need to do a _.get or similar here as it could be a highly nested property.
  // If the sort field is set ahead of time, it could also be a toplevel attribute on the node
  const modFirst: string | number | null = modifier
    ? modifier(firstValue?.[property])
    : firstValue?.[property];
  const modSecond: string | number | null = modifier
    ? modifier(secondValue?.[property])
    : secondValue?.[property];

  if (modFirst === modSecond || typeof modFirst === 'string' || typeof modSecond === 'string') {
    return String(modFirst).localeCompare(String(modSecond));
  } else if (modFirst === null || modSecond === null) {
    // sort `null`'s as higher than numbers
    return (modFirst === null ? 1 : 0) - (modSecond === null ? 1 : 0);
  } else {
    // sort in ascending order.
    return modFirst - modSecond;
  }
}
