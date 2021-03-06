/* @flow */

import React, {PureComponent} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';

import {sortAlphabetically} from '../search/sorting';
import {hasType} from '../api/api__resource-types';
import {getEntityPresentation} from '../issue-formatter/issue-formatter';
import {IconAngleDown, IconClose, IconLock} from '../icon/icon';
import Select from '../select/select';
import IssueVisibility from './issue-visibility';
import {visibilityDefaultText} from './visibility-strings';

import {HIT_SLOP} from '../common-styles/button';
import {DEFAULT_THEME} from '../theme/theme';

import styles from './visibility-control.styles';

import type {User} from '../../flow/User';
import type {UserGroup} from '../../flow/UserGroup';
import type {Visibility} from '../../flow/Visibility';
import type {ViewStyleProp} from 'react-native/Libraries/StyleSheet/StyleSheet';
import type {UITheme} from '../../flow/Theme';

type Props = {
  visibility?: Visibility,
  onApply: (visibility: Visibility) => any,
  getOptions: () => Array<any>,
  onSubmit?: ?(visibility: Visibility) => any,
  style: ?ViewStyleProp,
  uiTheme: UITheme,
  visibilityDefaultLabel?: string
};

type State = {
  visibility: Visibility | null,
  isSelectVisible: boolean
}


export default class VisibilityControl extends PureComponent<Props, State> {
  static defaultProps: $Shape<Props> = {
    visibility: null,
    onApply: (visibility: Visibility) => null,
    getOptions: () => [],
    style: null,
    uiTheme: DEFAULT_THEME,
    visibilityDefaultLabel: visibilityDefaultText
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      visibility: props.visibility,
      isSelectVisible: false
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.visibility !== this.props.visibility) {
      this.setState({
        visibility: this.props.visibility
      });
    }
  }

  updateVisibility = (visibility: Visibility | null) => {
    this.setState({visibility});
    if (this.props.onSubmit) {
      this.props.onSubmit(visibility);
      return this.closeSelect();
    }
    this.props.onApply(visibility);
  };

  getVisibilityOptions = async () => {
    try {
      return this.props.getOptions();
    } catch (e) {
      return {};
    }
  };

  createSelectItems = (visibility: Visibility): Array<User | UserGroup> => {
    const visibilityGroups: Array<UserGroup> = (
      visibility.visibilityGroups || visibility.permittedGroups || []
    ).filter((group: UserGroup) => !group.allUsersGroup).sort(sortAlphabetically);

    const visibilityUsers: Array<User> = (
      visibility.visibilityUsers || visibility.permittedUsers || []
    ).sort(sortAlphabetically);

    return visibilityGroups.concat(visibilityUsers);
  };

  getVisibilitySelectItems = async () => {
    const visibility: Visibility = await this.getVisibilityOptions();
    return this.createSelectItems(visibility);
  };

  setSelectVisible = (isVisible: boolean) => {
    this.setState({isSelectVisible: isVisible});
  };

  openSelect = () => {
    this.setSelectVisible(true);
  };

  closeSelect = () => {
    this.setSelectVisible(false);
  };

  onSelect = (selectedItems: ?Array<User | UserGroup>) => {
    const visibility: Visibility = IssueVisibility.visibility({
      permittedGroups: (selectedItems || []).filter(it => hasType.userGroup(it)),
      permittedUsers: (selectedItems || []).filter(it => hasType.user(it))
    });

    this.updateVisibility(visibility);
    this.closeSelect();
  };

  resetVisibility = () => {
    this.updateVisibility(null);
  };

  getVisibilitySelectedItems = (): Array<User | UserGroup> => {
    const {visibility} = this.state;
    return (
      visibility
        ? [].concat(visibility.permittedGroups || []).concat(visibility.permittedUsers || [])
        : []
    );
  };

  getItemTitle = (item: Object) => getEntityPresentation(item);

  renderSelect() {
    return (
      <Select
        multi={true}
        emptyValue={null}
        placeholder='Filter users, groups, and teams'
        selectedItems={this.getVisibilitySelectedItems()}
        getTitle={this.getItemTitle}
        dataSource={this.getVisibilitySelectItems}
        onSelect={this.onSelect}
        onCancel={this.closeSelect}
      />
    );
  }

  getVisibilityPresentation(visibility: Visibility): string {
    const author: ?User = visibility?.implicitPermittedUsers && visibility.implicitPermittedUsers[0];
    return [
      getEntityPresentation(author),
      IssueVisibility.getVisibilityShortPresentation(visibility)
    ].filter(Boolean).join(', ');
  }

  renderVisibilityButton() {
    const {onSubmit, visibilityDefaultLabel = ''} = this.props;
    const {visibility} = this.state;

    const isSecured: boolean = IssueVisibility.isSecured(visibility);
    const label: string = (
      visibility?.inherited
        ? 'Inherited restrictions'
        : isSecured ? this.getVisibilityPresentation(visibility) : visibilityDefaultLabel
    );

    return (
      <View
        testID="visibilityControlButton"
        style={[
          styles.container,
          this.props.style
        ]}
      >
        {!onSubmit && isSecured && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={this.resetVisibility}
            hitSlop={HIT_SLOP}
          >
            <IconClose size={16} color={this.props.uiTheme.colors.$link}/>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.container}
          onPress={this.openSelect}
          hitSlop={HIT_SLOP}
        >
          {(isSecured || visibility?.inherited) && (
            <IconLock
              style={styles.buttonIcon}
              size={16}
              color={this.props.uiTheme.colors.$iconAccent}
            />
          )}
          <Text style={styles.buttonText}>
            {label}
          </Text>
          <IconAngleDown size={20} color={this.props.uiTheme.colors.$icon}/>
        </TouchableOpacity>
      </View>
    );
  }


  render() {
    return (
      <View testID="visibilityControl">

        {this.renderVisibilityButton()}
        {this.state.isSelectVisible && this.renderSelect()}

      </View>
    );
  }
}
