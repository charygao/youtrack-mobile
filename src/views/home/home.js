/* @flow */

import React, {PureComponent} from 'react';
import {View, Image, Text, TouchableOpacity, ActivityIndicator} from 'react-native';

import usage from '../../components/usage/usage';
import {formatYouTrackURL} from '../../components/config/config';
import {logo, IconPencil} from '../../components/icon/icon';
import {ThemeContext} from '../../components/theme/theme-context';

import {HIT_SLOP} from '../../components/common-styles/button';
import styles from './home.styles';

import type {Theme} from '../../flow/Theme';

type Props = {
  backendUrl: string,
  message: string,
  error: string | {message: string},
  onChangeBackendUrl: (newUrl: string) => any,
  onRetry: () => any
};

type State = {
  youTrackBackendUrl: string
}

export default class Home extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      youTrackBackendUrl: props.backendUrl
    };
    usage.trackScreenView('Loading');
  }

  _renderRetryAction() {
    if (!this.props.error) {
      return null;
    }
    return <TouchableOpacity
      onPress={() => this.props.onRetry()}>
      <Text style={styles.retry}>Retry</Text>
    </TouchableOpacity>;
  }

  _renderMessage() {
    const {error, message} = this.props;
    if (error) {
      // $FlowFixMe
      const message: string = error.message || error;
      return <Text style={[styles.message, {color: 'red'}]}>{message}</Text>;
    }

    if (message) {
      return <Text style={styles.message}>{message}</Text>;
    }
  }

  _renderUrlButton() {
    const {backendUrl} = this.props;
    if (!backendUrl) {
      return <ActivityIndicator style={styles.urlButton}/>;
    }

    return (
      <TouchableOpacity
        hitSlop={HIT_SLOP}
        style={styles.urlButton}
        onPress={() => this.props.onChangeBackendUrl(backendUrl)}>
        <Text style={styles.url}>{formatYouTrackURL(backendUrl)}</Text>
        <IconPencil style={styles.editUrlIcon} size={22} color={styles.retry.color}/>
      </TouchableOpacity>
    );
  }

  render() {
    return <ThemeContext.Consumer>
      {(theme: Theme) => {
        return (
          <View style={styles.container}>

            <View style={styles.logoContainer}>
              <Image style={styles.logoImage} source={logo}/>
            </View>

            {this._renderUrlButton()}

            <View style={styles.messageContainer}>
              {this._renderRetryAction()}
              {this._renderMessage()}
            </View>

          </View>
        );
      }}
    </ThemeContext.Consumer>;
  }
}
