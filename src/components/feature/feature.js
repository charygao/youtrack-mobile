/* @flow */
/*global __DEV__*/

import {useSelector} from 'react-redux';

import featureList from './features-list';
import {getApi} from '../api/api__instance';

type Props = {
  children: any,
  devOnly?: boolean,
  fallbackComponent?: React$Element<any>,
  featureName?: string,
  version?: string,
};

function convertToNumber(semverVersion: string) {
  const parts = semverVersion.split('.').reverse();

  return parts.reduce((acc, part, index) => {
    return acc + Number.parseInt(part) * Math.pow(1000, index);
  }, 0);
}

export const checkVersion = (version?: string) => {
  try {
    const {version: serverVersion} = getApi().config;

    if (version) {
      return convertToNumber(serverVersion) >= convertToNumber(version);
    } else {
      return true;
    }
  } catch (e) {
    return false;
  }
};

export const checkDev = () => __DEV__;

export const FEATURE_VERSION = featureList;

const Feature = (props: Props) => {
  const {fallbackComponent = null, children, featureName, version, devOnly} = props;
  const features: Array<string> = useSelector(state => state.app.features);

  const isFeatureEnabled: boolean = featureName ? features.indexOf(featureName) !== -1 : true;
  const isShown: boolean = isFeatureEnabled && checkVersion(version) && (devOnly ? checkDev() : true);
  return isShown ? children : fallbackComponent;
};


export default Feature;
