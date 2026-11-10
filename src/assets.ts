/**
 * @fileoverview Images and sounds the user imported, loaded once from the
 * backend as data URLs and kept for the session.
 */

import {callable} from '@decky/api';
import {useEffect, useState} from 'react';

const getAsset = callable<[name: string], string>('get_asset');

// Data URLs of up to 2.7 MB each.
const MAX_LOADED = 8;
const loaded = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

/** Returns a stored file's data URL once loaded, '' for none or a failed read. */
export function assetUrl(name: string): string | undefined {
  return name ? loaded.get(name) : '';
}

/** Loads a stored file (see main.py import_asset); resolves to its data URL. */
export function loadAsset(name: string): Promise<string> {
  const done = assetUrl(name);
  if (done !== undefined) return Promise.resolve(done);
  let request = pending.get(name);
  if (!request) {
    request = getAsset(name)
      .then((url) => {
        loaded.set(name, url);
        // Four trophies and a sound in use; older ones drop out first.
        if (loaded.size > MAX_LOADED) {
          loaded.delete(loaded.keys().next().value as string);
        }
        return url;
      })
      .catch((error: unknown) => {
        console.warn('[AchievementCustomizer] could not load', name, error);
        return '';
      })
      .finally(() => {
        pending.delete(name);
      });
    pending.set(name, request);
  }
  return request;
}

/** A stored file's data URL; re-renders when it arrives. '' while none. */
export function useAsset(name: string): string {
  const [, setLoads] = useState(0);
  useEffect(() => {
    if (assetUrl(name) !== undefined) return;
    let mounted = true;
    void loadAsset(name).then(() => {
      if (mounted) setLoads((count) => count + 1);
    });
    return () => {
      mounted = false;
    };
  }, [name]);
  return assetUrl(name) ?? '';
}
