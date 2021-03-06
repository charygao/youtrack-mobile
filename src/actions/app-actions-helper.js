/* @flow */

import log from '../components/log/log';
import PermissionsHelper from '../components/permissions-store/permissions-helper';
import {flushStoragePart, getOtherAccounts, getStorageState} from '../components/storage/storage';
import {notify} from '../components/notification/notification';
import {removeTrailingSlash} from '../util/util';

import type {PermissionCacheItem} from '../flow/Permission';
import type {StorageState} from '../components/storage/storage';

function updateCachedPermissions(permissions: ?Array<PermissionsHelper>): void {
  flushStoragePart({permissions});
}

function getCachedPermissions(): ?Array<PermissionCacheItem> {
  return getStorageState().permissions;
}

async function loadPermissions(token_type: ?string, access_token: ?string, permissionsCacheUrl: string): Promise<Array<PermissionCacheItem>> {
  let permissions: Array<PermissionCacheItem> = [];

  try {
    permissions = PermissionsHelper.loadPermissions(
      token_type,
      access_token,
      permissionsCacheUrl
    );
    log.info('Permissions loaded');
  } catch (error) {
    const errorMessage: string = 'Failed to load permissions. You\'re unable to make any changes.';
    notify(errorMessage, 7000);
    log.warn(errorMessage, error);
  }

  return permissions;
}

async function targetAccountToSwitchTo(targetBackendUrl: string = '') {
  if (!targetBackendUrl) {
    return null;
  }

  let targetAccount = null;
  const storageState: StorageState = getStorageState();

  if (targetBackendUrl && removeTrailingSlash(targetBackendUrl) !== removeTrailingSlash(storageState.config?.backendUrl || '')) {
    const otherAccounts = await getOtherAccounts();
    targetAccount = otherAccounts.find(
      (account: StorageState) => removeTrailingSlash(account.config?.backendUrl || '') === removeTrailingSlash(targetBackendUrl)
    );
  }

  return targetAccount;
}

export {
  updateCachedPermissions,
  getCachedPermissions,
  loadPermissions,
  targetAccountToSwitchTo
};
