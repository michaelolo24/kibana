/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { Subject } from 'rxjs';
import { take, toArray } from 'rxjs/operators';

import { ILicense } from './types';
import { createLicenseUpdate } from './license_update';
import { licenseMock } from './licensing.mock';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const stop$ = new Subject();
describe('licensing update', () => {
  it('loads updates when triggered', async () => {
    const trigger$ = new Subject();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(licenseMock.createLicense({ license: { type: 'basic' } }))
      .mockResolvedValueOnce(licenseMock.createLicense({ license: { type: 'gold' } }));

    const { license$ } = createLicenseUpdate(trigger$, stop$, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(0);

    trigger$.next();
    const first = await license$.pipe(take(1)).toPromise();
    expect(first.type).toBe('basic');

    trigger$.next();
    const [, second] = await license$.pipe(take(2), toArray()).toPromise();
    expect(second.type).toBe('gold');
  });

  it('starts with initial value if presents', async () => {
    const initialLicense = licenseMock.createLicense({ license: { type: 'platinum' } });
    const fetchedLicense = licenseMock.createLicense({ license: { type: 'gold' } });
    const trigger$ = new Subject();

    const fetcher = jest.fn().mockResolvedValue(fetchedLicense);
    const { license$ } = createLicenseUpdate(trigger$, stop$, fetcher, initialLicense);
    trigger$.next();
    const [first, second] = await license$.pipe(take(2), toArray()).toPromise();

    expect(first.type).toBe('platinum');
    expect(second.type).toBe('gold');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not emit if license has not changed', async () => {
    const trigger$ = new Subject();

    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(licenseMock.createLicense())
      .mockResolvedValueOnce(licenseMock.createLicense())
      .mockResolvedValueOnce(licenseMock.createLicense({ license: { type: 'gold' } }));

    const { license$ } = createLicenseUpdate(trigger$, stop$, fetcher);
    trigger$.next();

    const [first] = await license$.pipe(take(1), toArray()).toPromise();

    expect(first.type).toBe('basic');

    trigger$.next();
    // waiting on a promise gives the exhaustMap time to complete and not de-dupe these calls
    await Promise.resolve();
    trigger$.next();

    const [, second] = await license$.pipe(take(2), toArray()).toPromise();

    expect(second.type).toBe('gold');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('new subscriptions does not force re-fetch', async () => {
    const trigger$ = new Subject();

    const fetcher = jest.fn().mockResolvedValue(licenseMock.createLicense());

    const { license$ } = createLicenseUpdate(trigger$, stop$, fetcher);

    license$.subscribe(() => {});
    license$.subscribe(() => {});
    license$.subscribe(() => {});
    trigger$.next();

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('ignores trigger if license fetching is delayed ', async () => {
    const delayMs = 100;
    const fetcher = jest.fn().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve(licenseMock.createLicense({ license: { type: 'gold' } })),
            delayMs
          );
        })
    );
    const trigger$ = new Subject();
    const { license$ } = createLicenseUpdate(trigger$, stop$, fetcher);
    const values: ILicense[] = [];
    license$.subscribe((license) => values.push(license));

    trigger$.next();
    trigger$.next();

    await delay(delayMs * 2);

    await expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(values).toHaveLength(1);
    await expect(values[0].type).toBe('gold');
  });

  it('completes license$ stream when stop$ is triggered', () => {
    const trigger$ = new Subject();
    const fetcher = jest.fn().mockResolvedValue(licenseMock.createLicense());

    const { license$ } = createLicenseUpdate(trigger$, stop$, fetcher);
    let completed = false;
    license$.subscribe({ complete: () => (completed = true) });

    stop$.next();
    expect(completed).toBe(true);
  });

  it('stops fetching when stop$ is triggered', () => {
    const trigger$ = new Subject();
    const fetcher = jest.fn().mockResolvedValue(licenseMock.createLicense());

    const { license$ } = createLicenseUpdate(trigger$, stop$, fetcher);
    const values: ILicense[] = [];
    license$.subscribe((license) => values.push(license));

    stop$.next();
    trigger$.next();

    expect(fetcher).toHaveBeenCalledTimes(0);
  });

  it(`refreshManually multiple times gets new license`, async () => {
    const trigger$ = new Subject();
    const firstLicense = licenseMock.createLicense({ license: { uid: 'first', type: 'basic' } });
    const secondLicense = licenseMock.createLicense({ license: { uid: 'second', type: 'gold' } });

    const fetcher = jest
      .fn()
      .mockImplementationOnce(async () => {
        await delay(100);
        return firstLicense;
      })
      .mockImplementationOnce(async () => {
        await delay(100);
        return secondLicense;
      });

    const { license$, refreshManually } = createLicenseUpdate(trigger$, stop$, fetcher);
    let fromObservable;
    license$.subscribe((license) => (fromObservable = license));

    const licenseResult = await refreshManually();
    expect(licenseResult.uid).toBe('first');
    expect(licenseResult).toBe(fromObservable);

    const secondResult = await refreshManually();
    expect(secondResult.uid).toBe('second');
    expect(secondResult).toBe(fromObservable);
  });
});
