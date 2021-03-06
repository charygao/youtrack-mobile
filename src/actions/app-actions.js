/* @flow */

import {Linking} from 'react-native';

import DeviceInfo from 'react-native-device-info';

import * as appActionsHelper from './app-actions-helper';
import * as types from './action-types';
import Api from '../components/api/api';
import Auth from '../components/auth/auth';
import log from '../components/log/log';
import openByUrlDetector, {isOneOfServers} from '../components/open-url-handler/open-url-handler';
import packageJson from '../../package.json'; // eslint-disable-line import/extensions
import PermissionsStore from '../components/permissions-store/permissions-store';
import PushNotifications from '../components/push-notifications/push-notifications';
import Router from '../components/router/router';
import UrlParse from 'url-parse';
import usage from '../components/usage/usage';
import {CUSTOM_ERROR_MESSAGE, UNSUPPORTED_ERRORS} from '../components/error/error-messages';
import {EVERYTHING_CONTEXT} from '../components/search/search-context';
import {getIsAuthorized} from '../reducers/app-reducer';
import {
  initialState,
  clearCachesAndDrafts,
  populateStorage,
  getStorageState,
  flushStorage,
  flushStoragePart,
  getOtherAccounts,
  storeAccounts
} from '../components/storage/storage';
import {isIOSPlatform, until} from '../util/util';
import {isUnsupportedFeatureError} from '../components/error/error-resolver';
import {loadConfig} from '../components/config/config';
import {logEvent} from '../components/log/log-helper';
import {notify, notifyError} from '../components/notification/notification';
import {setApi} from '../components/api/api__instance';
import {storeSearchContext} from '../views/issues/issues-actions';

import type RootState from '../reducers/app-reducer';
import type {AppConfigFilled, EndUserAgreement} from '../flow/AppConfig';
import type {AppState} from '../reducers';
import type {AuthParams} from '../flow/Auth';
import type {Folder, User, UserAppearanceProfile, UserGeneralProfile} from '../flow/User';
import type {NotificationRouteData} from '../flow/Notification';
import type {PermissionCacheItem} from '../flow/Permission';
import type {StorageState} from '../components/storage/storage';
import type {WorkTimeSettings} from '../flow/Work';


export function logOut() {
  return async (dispatch: (any) => any, getState: () => Object, getApi: () => Api) => {
    clearCachesAndDrafts();
    const auth = getState().app.auth;
    Router.EnterServer({serverUrl: auth?.config?.backendUrl});
    if (auth) {
      auth.logOut();
    }
    setApi(null);
    dispatch({type: types.LOG_OUT});
    log.info('User is logged out');
  };
}

export function openDebugView() {
  return {type: types.OPEN_DEBUG_VIEW};
}

export function closeDebugView() {
  return {type: types.CLOSE_DEBUG_VIEW};
}

export function setEnabledFeatures(features: Array<string>) {
  return {type: types.SET_FEATURES, features};
}

export function onNavigateBack(closingView: Object) {
  return {type: types.ON_NAVIGATE_BACK, closingView};
}

export function receiveOtherAccounts(otherAccounts: Array<StorageState>) {
  return {type: types.RECEIVE_OTHER_ACCOUNTS, otherAccounts};
}

export function receiveUser(user: User) {
  return {type: types.RECEIVE_USER, user};
}

export function receiveUserAppearanceProfile(userAppearanceProfile?: UserAppearanceProfile) {
  return async (dispatch: (any) => any, getState: () => RootState, getApi: () => Api) => {
    if (!userAppearanceProfile) {
      return;
    }
    try {
      const appearanceProfile: UserAppearanceProfile = await getApi().user.updateUserAppearanceProfile(
        'me',
        userAppearanceProfile
      );
      dispatch({
        type: types.RECEIVE_USER_APPEARANCE_PROFILE,
        ...{appearance: appearanceProfile}
      });
    } catch (error) {
      log.info('Can\'t update user appearance profile.');
    }
  };
}

export function updateUserGeneralProfile(userGeneralProfile: UserGeneralProfile) {
  return async (dispatch: (any) => any, getState: () => RootState, getApi: () => Api) => {
    try {
      const updatedUserGeneralProfile: UserGeneralProfile = await getApi().user.updateUserGeneralProfile(
        userGeneralProfile
      );

      if (updatedUserGeneralProfile.searchContext === null) {
        updatedUserGeneralProfile.searchContext = EVERYTHING_CONTEXT;
      }

      dispatch({
        type: types.RECEIVE_USER_GENERAL_PROFILE,
        ...{general: updatedUserGeneralProfile}
      });
    } catch (e) {
      log.info('Cannot update your profile');
    }
  };
}

export const setUserLastVisitedArticle = (articleId: string | null) => {
  return async (dispatch: (any) => any, getState: () => AppState, getApi: () => Api) => {
    const api: Api = getApi();
    const [error, articlesProfile] = await until(api.user.updateLastVisitedArticle(articleId));
    if (error) {
      logEvent({
        message: 'Failed to update last visited article in a user profile',
        isError: true
      });
    } else {
      dispatch({
        type: types.RECEIVE_USER_ARTICLES_PROFILE,
        ...{articles: articlesProfile}
      });
    }
  };
};

export function checkAuthorization() {
  return async (dispatch: (any) => any, getState: () => Object) => {
    const auth = getState().app.auth;
    await auth.setAuthParamsFromCache();
    await flushStoragePart({currentUser: auth.currentUser});

    setApi(new Api(auth));
  };
}

export function setAuth(config: AppConfigFilled) {
  const auth = new Auth(config);
  usage.init(config.statisticsEnabled);

  return {type: types.INITIALIZE_AUTH, auth};
}

function showUserAgreement(agreement) {
  usage.trackEvent('EUA is shown');
  return {type: types.SHOW_USER_AGREEMENT, agreement};
}

async function storeConfig(config: AppConfigFilled) {
  await flushStoragePart({config});
}

function populateAccounts() {
  return async (dispatch: (any) => any, getState: () => Object) => {
    const otherAccounts = await getOtherAccounts();
    dispatch(receiveOtherAccounts(otherAccounts));
  };
}

function beginAccountChange() {
  return {type: types.BEGIN_ACCOUNT_CHANGE};
}

function endAccountChange() {
  return {type: types.END_ACCOUNT_CHANGE};
}

async function connectToOneMoreServer(serverUrl: string, onBack: Function): Promise<AppConfigFilled> {
  return new Promise(resolve => {
    Router.EnterServer({
      onCancel: onBack,
      serverUrl,
      connectToYoutrack: async (newURL) => resolve(await loadConfig(newURL))
    });
  });
}

async function authorizeOnOneMoreServer(config: AppConfigFilled, onBack: (serverUrl: string) => any) {
  return new Promise(resolve => {
    Router.LogIn({
      config,
      onChangeServerUrl: onBack,
      onLogIn: (authParams: AuthParams) => resolve(authParams)
    });
  });
}

function applyAccount(config: AppConfigFilled, auth: Auth, authParams: AuthParams) {
  return async (dispatch: (any) => any, getState: () => RootState) => {
    const otherAccounts = getState().app.otherAccounts;
    const currentAccount = getStorageState();
    const newOtherAccounts = [currentAccount, ...otherAccounts];

    await storeAccounts(newOtherAccounts);
    dispatch(receiveOtherAccounts(newOtherAccounts));
    await flushStorage(initialState);

    await auth.cacheAuthParams(authParams);
    await storeConfig(config);

    await dispatch(initializeAuth(config));
    await dispatch(checkUserAgreement());

    if (!getState().app.showUserAgreement) {
      await dispatch(completeInitialization());
    }
  };
}

export function addAccount(serverUrl: string = '') {
  return async (dispatch: (any) => any, getState: () => RootState) => {
    log.info('Adding new account started');

    try {
      const config: AppConfigFilled = await connectToOneMoreServer(serverUrl, () => {
        log.info('Adding new server canceled by user');
        Router.navigateToDefaultRoute();
      });
      log.info(`Config loaded for new server (${config.backendUrl}), logging in...`);

      const tmpAuthInstance: Auth = new Auth(config); //NB! this temporary instance for Login screen code
      const authParams: AuthParams = await authorizeOnOneMoreServer(config, function onBack(serverUrl: string) {
        log.info('Authorization canceled by user, going back');
        dispatch(addAccount(serverUrl));
      });
      log.info('Authorized on new server, applying');

      await dispatch(applyAccount(config, tmpAuthInstance, authParams));
      await flushStoragePart({creationTimestamp: Date.now()});

      const user = (getStorageState().currentUser || {});
      log.info(`Successfully added account, user "${user.name}", server "${config.backendUrl}"`);
    } catch (err) {
      const errorMsg: string = 'Failed to add an account.';
      notifyError(errorMsg, err);
      const {otherAccounts} = getState().app;
      if (!getStorageState().config && otherAccounts.length) {
        log.info(`${errorMsg} Restoring prev account`);
        await dispatch(switchAccount(otherAccounts[0], true));
      }
      Router.navigateToDefaultRoute();
    }
  };
}

export function switchAccount(account: StorageState, dropCurrentAccount: boolean = false, issueId?: string) {
  return async (dispatch: (any) => any) => {
    try {
      await dispatch(changeAccount(account, dropCurrentAccount, issueId));
    } catch (e) {
      await dispatch(changeAccount(getStorageState()));
    }
  };
}

export function updateOtherAccounts(account: StorageState, removeCurrentAccount: boolean = false) {
  return async (dispatch: (any) => any, getState: () => RootState) => {
    const state: RootState = getState();

    const currentAccount: StorageState = getStorageState();
    log.info(`Changing account: ${currentAccount?.config?.backendUrl || ''} -> ${account?.config?.backendUrl || ''}`);

    const otherAccounts = state.app.otherAccounts.filter(
      (it: StorageState) => it.creationTimestamp !== account.creationTimestamp
    );
    const prevAccount = removeCurrentAccount ? null : currentAccount;
    const updatedOtherAccounts = [
      ...(prevAccount && currentAccount !== account ? [prevAccount] : []),
      ...otherAccounts
    ];
    await storeAccounts(updatedOtherAccounts);
    await flushStorage(account);

    dispatch(receiveOtherAccounts(updatedOtherAccounts));
    return otherAccounts;
  };
}

export function changeAccount(account: StorageState, removeCurrentAccount?: boolean, issueId: ?string) {
  return async (dispatch: (any) => any, getState: () => RootState) => {
    const state: RootState = getState();
    const {config, authParams} = account;
    if (!authParams) {
      const errorMessage: string = 'Account doesn\'t have valid authorization, cannot switch onto it.';
      notify(errorMessage);
      throw new Error(errorMessage);
    }
    const auth = new Auth(config);

    dispatch(beginAccountChange());

    try {
      await dispatch(updateOtherAccounts(account, removeCurrentAccount));

      await auth.cacheAuthParams(authParams);
      await storeConfig(config);

      await dispatch(initializeAuth(config));
      await dispatch(checkUserAgreement());

      if (!state.app.showUserAgreement) {
        dispatch(completeInitialization(issueId));
      }
      log.info('Account changed, URL:', account?.config?.backendUrl);
    } catch (err) {
      notifyError('Could not change account', err);
    }

    dispatch(endAccountChange());
  };
}

export function removeAccountOrLogOut() {
  return async (dispatch: (any) => any, getState: () => RootState, getApi: () => Api) => {
    const otherAccounts: Array<StorageState> = getState().app.otherAccounts;

    if (isRegisteredForPush()) {
      setRegisteredForPush(false);
      try {
        await PushNotifications.unregister(getApi());
      } catch (err) {
        log.warn('Failed to unsubscribe from push notifications', err);
      }
    }

    if (otherAccounts.length === 0) {
      log.info('No more accounts left, logging out.');
      return dispatch(logOut());
    }
    log.info('Removing account, choosing another one.');
    await dispatch(switchAccount(otherAccounts[0], true));
  };
}

function setUserPermissions(permissions: Array<PermissionCacheItem>) {
  return async (dispatch: (any) => any, getState: () => RootState) => {
    const auth: Auth = getState().app.auth;
    dispatch({
      type: types.SET_PERMISSIONS,
      permissionsStore: new PermissionsStore(permissions),
      currentUser: auth.currentUser
    });
  };
}

export function loadUserPermissions() {
  return async (dispatch: (any) => any, getState: () => Object) => {
    const auth: Auth = getState().app.auth;
    const authParams: AuthParams = auth.authParams;
    const permissions: Array<PermissionCacheItem> = await appActionsHelper.loadPermissions(
      authParams?.token_type,
      authParams?.access_token,
      auth.getPermissionsCacheURL()
    );

    await dispatch(setUserPermissions(permissions));
    log.info('PermissionsStore created');
    appActionsHelper.updateCachedPermissions(permissions);
    log.debug('Permissions stored');
  };
}

export function completeInitialization(issueId: ?string = null) {
  return async (dispatch: (any) => any) => {
    log.debug('Completing initialization');
    await dispatch(loadUser());
    await dispatch(loadUserPermissions());
    await dispatch(storeProjectsShortNames());
    log.debug('Initialization completed');

    Router.navigateToDefaultRoute(issueId ? {issueId} : null);

    dispatch(loadWorkTimeSettings());
    dispatch(subscribeToPushNotifications());
  };
}

function loadUser() {
  return async (dispatch: (any) => any, getState: () => RootState, getApi: () => Api) => {
    const USER_DEFAULT_PROFILES: UserGeneralProfile & UserAppearanceProfile = {
      general: {searchContext: null},
      appearance: {naturalCommentsOrder: true}
    };

    let user: User = await getApi().user.getUser();
    user = Object.assign(
      {},
      user,
      {profiles: user.profiles || USER_DEFAULT_PROFILES}
    );

    if (!user.profiles.general?.searchContext) {
      user.profiles.general.searchContext = EVERYTHING_CONTEXT;
    }

    await dispatch(storeSearchContext(user.profiles.general.searchContext));

    dispatch({type: types.RECEIVE_USER, user});
  };
}

function loadWorkTimeSettings() {
  return async (dispatch: (any) => any, getState: () => RootState, getApi: () => Api) => {
    const workTimeSettings: WorkTimeSettings = await getApi().getWorkTimeSettings();
    await dispatch({type: types.RECEIVE_WORK_TIME_SETTINGS, workTimeSettings});
  };
}

export function acceptUserAgreement() {
  return async (dispatch: (any) => any, getState: () => Object, getApi: () => Api) => {
    log.info('User agreement accepted');
    usage.trackEvent('EUA is accepted');
    const api: Api = getApi();

    await api.acceptUserAgreement();

    dispatch({type: types.HIDE_USER_AGREEMENT});
    dispatch(completeInitialization());
  };
}

export function declineUserAgreement() {
  return async (dispatch: (any) => any, getState: () => Object, getApi: () => Api) => {
    log.info('User agreement declined');
    usage.trackEvent('EUA is declined');
    dispatch({type: types.HIDE_USER_AGREEMENT});
    dispatch(removeAccountOrLogOut());
  };
}

export function initializeAuth(config: AppConfigFilled) {
  return async (dispatch: (any) => any, getState: () => Object) => {
    dispatch(setAuth(config));
    await dispatch(checkAuthorization());
  };
}

function checkUserAgreement() {
  return async (dispatch: (any) => any, getState: () => Object, getApi: () => Api) => {
    const api: Api = getApi();
    const auth = getState().app.auth;
    const {currentUser} = auth;

    log.debug('Checking user agreement', currentUser);
    if (currentUser && currentUser.endUserAgreementConsent && currentUser.endUserAgreementConsent.accepted) {
      log.info('The EUA already accepted, skip check');
      return;
    }

    const agreement: ?EndUserAgreement = await api.getUserAgreement();
    if (!agreement) {
      log.debug('EUA is not supported, skip check');
      return;
    }
    if (!agreement.enabled) {
      log.debug('EUA is disabled, skip check');
      return;
    }

    log.info('User agreement should be accepted', {...agreement, text: 'NOT_PRINTED'}, currentUser);
    dispatch(showUserAgreement(agreement));
  };
}

export function applyAuthorization(authParams: AuthParams) {
  return async (dispatch: Function, getState: () => Object) => {
    const auth = getState().app.auth;
    if (auth && authParams) {
      await auth.cacheAuthParams(authParams);
    }
    await flushStoragePart({creationTimestamp: Date.now()});

    await dispatch(checkAuthorization());
    await dispatch(checkUserAgreement());

    if (!getState().app.showUserAgreement) {
      dispatch(completeInitialization());
    }
  };
}

function storeProjectsShortNames() {
  return async (dispatch: (any) => any, getState: () => RootState, getApi: () => Api) => {
    const userFolders: Array<Folder> = await getApi().user.getUserFolders('', ['id,shortName,name,pinned']);
    await flushStoragePart({projects: userFolders.filter(it => it.shortName)});
  };
}

function subscribeToURL() {
  return async (dispatch: (any) => any, getState: () => Object) => {
    function isServerConfigured(url: ?string) {
      if (!isOneOfServers(url || '', [(getStorageState().config || {}).backendUrl])) {
        notifyError('Open URL error', {message: `"${url || ''}" doesn't match the configured server`});
        return false;
      }
      return true;
    }

    openByUrlDetector(
      (url, issueId) => {
        if (!getIsAuthorized(getState().app) || !isServerConfigured(url)) {
          log.debug('User is not authorized, URL won\'t be opened');
          return;
        }
        usage.trackEvent('app', 'Open issue in app by URL');
        Router.Issue({issueId}, {forceReset: true});
      },
      (url, issuesQuery) => {
        if (!getIsAuthorized(getState().app) || !isServerConfigured(url)) {
          log.debug('User is not authorized, URL won\'t be opened');
          return;
        }
        usage.trackEvent('app', 'Open issues query in app by URL');
        Router.Issues({query: issuesQuery});
      });
  };
}

export function initializeApp(config: AppConfigFilled, issueId: ?string) {
  return async (dispatch: (any) => any, getState: () => Object) => {
    Router._getNavigator() && Router.Home({
      backendUrl: config.backendUrl,
      error: null,
      message: 'Connecting to YouTrack...'
    });

    try {
      if (packageJson.version !== getStorageState().currentAppVersion) {
        log.info(`App upgraded from ${getStorageState().currentAppVersion || 'NOTHING'} to "${packageJson.version}"; reloading config`);
        config = await loadConfig(config.backendUrl);
        await flushStoragePart({config, currentAppVersion: packageJson.version});
      }

      await dispatch(initializeAuth(config));
    } catch (error) {
      log.log('App failed to initialize auth. Reloading config...', error);
      let reloadedConfig;
      try {
        reloadedConfig = await loadConfig(config.backendUrl);
        await storeConfig(reloadedConfig);
      } catch (error) {
        return Router.Home({backendUrl: config.backendUrl, error});
      }

      try {
        await dispatch(initializeAuth(reloadedConfig));
      } catch (e) {
        return Router.LogIn({config});
      }
    }

    await dispatch(checkUserAgreement());

    if (!getState().app.showUserAgreement) {
      await dispatch(completeInitialization(issueId));
    }

    dispatch(subscribeToURL());
  };
}

export function connectToNewYoutrack(newURL: string) {
  return async (dispatch: (any) => any) => {
    const config = await loadConfig(newURL);
    await storeConfig(config);
    dispatch(setAuth(config));
    Router.LogIn({config});
  };
}

export function setAccount(notificationRouteData: NotificationRouteData) {
  return async (dispatch: (any) => any) => {
    const state: StorageState = await populateStorage();
    await dispatch(populateAccounts());

    const notificationBackendUrl: ?string = notificationRouteData.backendUrl;
    if (notificationBackendUrl && state?.config && notificationBackendUrl !== state.config?.backendUrl) {
      const notificationIssueAccount: ?StorageState = await appActionsHelper.targetAccountToSwitchTo(notificationBackendUrl);
      if (notificationIssueAccount) {
        await dispatch(updateOtherAccounts(notificationIssueAccount));
        flushStoragePart({config: notificationIssueAccount.config});
      }
    }

    const targetConfig = getStorageState().config;
    if (targetConfig) {
      return dispatch(initializeApp(targetConfig, notificationRouteData.issueId));
    }

    log.info('App is not configured, entering server URL');
    try {
      const url = await Linking.getInitialURL();
      if (!url) {

        return Router.EnterServer({serverUrl: null});
      }
      const host = UrlParse(url).host;
      return Router.EnterServer({serverUrl: host});
    } catch (e) {
      Router.EnterServer({serverUrl: null});
    }
  };
}

export function subscribeToPushNotifications() {
  return async (dispatch: (any) => any, getState: () => RootState, getApi: () => Api) => {
    if (DeviceInfo.isEmulator()) {
      return;
    }

    const onSwitchAccount = async (account: StorageState, issueId: string) => (
      await dispatch(switchAccount(account, false, issueId))
    );

    if (isRegisteredForPush()) {
      log.info('Device was already registered for push notifications. Initializing.');
      // $FlowFixMe: should be implemented for iOS
      return PushNotifications.initialize(getApi(), onSwitchAccount);
    }

    try {
      await PushNotifications.register(getApi());
      // $FlowFixMe: should be implemented for iOS
      PushNotifications.initialize(getApi(), onSwitchAccount);
      setRegisteredForPush(true);
      log.info('Successfully registered for push notifications');
    } catch (err) {
      if (isUnsupportedFeatureError(err)) {
        return log.warn(UNSUPPORTED_ERRORS.PUSH_NOTIFICATION_NOT_SUPPORTED);
      }

      log.warn(CUSTOM_ERROR_MESSAGE.PUSH_NOTIFICATION_REGISTRATION);
      notify(CUSTOM_ERROR_MESSAGE.PUSH_NOTIFICATION_REGISTRATION, err);
    }
  };
}


function isRegisteredForPush(): boolean { //TODO: YTM-1267
  const storageState: StorageState = getStorageState();
  return isIOSPlatform() ? storageState.isRegisteredForPush : Boolean(storageState.deviceToken);
}

async function setRegisteredForPush(isRegistered: boolean) {
  if (isIOSPlatform()) { //TODO: also use device token
    flushStoragePart({isRegisteredForPush: isRegistered});
  }
}
