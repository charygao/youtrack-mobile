/* @flow */

import {ScrollView, View, Text, TouchableOpacity, ActivityIndicator} from 'react-native';
import React, {Component} from 'react';

import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import usage from '../../components/usage/usage';

import AttachFileDialog from '../../components/attach-file/attach-file-dialog';
import Header from '../../components/header/header';
import {getApi} from '../../components/api/api__instance';
import {IconCheck, IconClose, IconPaperClip} from '../../components/icon/icon';
import CustomFieldsPanel from '../../components/custom-fields-panel/custom-fields-panel';
import AttachmentsRow from '../../components/attachments-row/attachments-row';
import IssueSummary from '../../components/issue-summary/issue-summary';
import KeyboardSpacerIOS from '../../components/platform/keyboard-spacer.ios';

import * as createIssueActions from './create-issue-actions';
import {attachmentActions} from './create-issue__attachment-actions-and-types';

import {ThemeContext} from '../../components/theme/theme-context';

import PropTypes from 'prop-types';

import type {Attachment, CustomField, IssueProject} from '../../flow/CustomFields';
import type IssuePermissions from '../../components/issue-permissions/issue-permissions';
import type {CreateIssueState} from './create-issue-reducers';
import type {Theme, UITheme, UIThemeColors} from '../../flow/Theme';

import styles from './create-issue.styles';
import VisibilityControl from '../../components/visibility/visibility-control';

const CATEGORY_NAME = 'Create issue view';

type AdditionalProps = {
  issuePermissions: IssuePermissions,
  predefinedDraftId: ?string,
  getAttachActions: () => any,
};

type Props = CreateIssueState & typeof createIssueActions & typeof attachmentActions & AdditionalProps;

class CreateIssue extends Component<Props, void> {
  static contextTypes = {
    actionSheet: PropTypes.func
  };

  constructor(props) {
    super(props);
    usage.trackScreenView(CATEGORY_NAME);
  }

  UNSAFE_componentWillMount() {
    this.props.initializeWithDraftOrProject(this.props.predefinedDraftId);
  }

  onAddAttachment = async (attach: Attachment) => {
    const {uploadAttach, loadAttachments} = this.props;
    await uploadAttach(attach);
    loadAttachments();
  };

  cancelAddAttach = () => {
    const {cancelAddAttach, hideAddAttachDialog, attachingImage} = this.props;
    cancelAddAttach(attachingImage);
    hideAddAttachDialog();
  };

  renderAttachFileDialog(uiTheme: UITheme) {
    const {issue, getAttachActions, attachingImage} = this.props;

    if (!issue || !issue.id) {
      return null;
    }

    return (
      <AttachFileDialog
        issueId={issue.id}
        actions={getAttachActions()}
        attach={attachingImage}
        onCancel={this.cancelAddAttach}
        onAttach={this.onAddAttachment}
        uiTheme={uiTheme}
      />
    );
  }

  canUpdateField = (field: CustomField) => this.props.issuePermissions.canUpdateField(this.props.issue, field);

  canCreateIssueToProject = (project: IssueProject) => this.props.issuePermissions.canCreateIssueToProject(project);

  onFieldUpdate = async (field: CustomField, value: any) => await this.props.updateFieldValue(field, value);

  onUpdateProject = async (project: IssueProject) => await this.props.updateProject(project);

  renderCustomFieldPanel(uiTheme: UITheme) {
    const {issue} = this.props;

    return <CustomFieldsPanel
      autoFocusSelect
      testID="createIssueFields"

      issueId={issue.id}
      issueProject={issue.project}
      fields={issue.fields}

      hasPermission={{
        canUpdateField: this.canUpdateField,
        canCreateIssueToProject: this.canCreateIssueToProject,
        canEditProject: true
      }}

      onUpdate={this.onFieldUpdate}
      onUpdateProject={this.onUpdateProject}

      uiTheme={uiTheme}
    />;
  }

  renderIssueVisibility(uiTheme: UITheme) {
    const {issue, updateVisibility} = this.props;
    return (
      <View style={styles.visibility}>
        <VisibilityControl
          issueId={issue.id}
          visibility={issue.visibility}
          onSubmit={updateVisibility}
          uiTheme={uiTheme}
        />
      </View>
    );
  }

  render() {
    const {
      storeDraftAndGoBack,
      setIssueSummary,
      setIssueDescription,
      createIssue,
      issue,
      attachingImage,
      processing,
      removeAttachment,
      showAddAttachDialog,
      isAttachFileDialogVisible
    } = this.props;

    const isAttaching = attachingImage !== null;
    const isProcessing = processing || isAttaching;
    const canCreateIssue = issue.summary && issue?.project?.id && !isProcessing;

    return (
      <ThemeContext.Consumer>
        {(theme: Theme) => {
          const uiTheme: UITheme = theme.uiTheme;
          const uiThemeColors: UIThemeColors = uiTheme.colors;
          const hasProject: boolean = !!issue?.project?.id;

          const rightButton = (
            processing
              ? <ActivityIndicator color={uiThemeColors.$link}/>
              : <IconCheck size={20} color={canCreateIssue ? uiThemeColors.$link : uiThemeColors.$disabled}/>
          );
          return (
            <View
              testID="createIssue"
              style={styles.container}
            >
              <Header
                leftButton={<IconClose size={21} color={uiThemeColors.$link}/>}
                onBack={storeDraftAndGoBack}
                rightButton={rightButton}
                onRightButtonClick={() => canCreateIssue && createIssue()}>
                <Text style={styles.title}>New Issue</Text>
              </Header>

              <View style={styles.separator}/>

              {this.renderCustomFieldPanel(uiTheme)}

              {hasProject && this.renderIssueVisibility(uiTheme)}

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
              >
                <IssueSummary
                  testID="createIssueSummary"
                  style={styles.issueSummary}
                  showSeparator={true}
                  summary={issue.summary}
                  description={issue.description}
                  editable={!processing}
                  onSummaryChange={setIssueSummary}
                  onDescriptionChange={setIssueDescription}
                  uiTheme={uiTheme}
                />

                {hasProject && (
                  <View
                    testID="createIssueAttachments"
                    style={styles.attachesContainer}>

                    <AttachmentsRow
                      testID="createIssueAttachmentRow"
                      attachments={issue.attachments}
                      attachingImage={attachingImage}
                      imageHeaders={getApi().auth.getAuthorizationHeaders()}
                      canRemoveAttachment={true}
                      onRemoveImage={removeAttachment}
                      uiTheme={theme.uiTheme}
                    />

                    <View style={styles.attachButtonsContainer}>
                      <TouchableOpacity
                        testID="createIssueAttachmentButton"
                        disabled={isProcessing}
                        style={styles.attachButton}
                        onPress={showAddAttachDialog}
                      >
                        <IconPaperClip
                          size={24}
                          color={isProcessing ? uiThemeColors.$textSecondary : uiThemeColors.$link}
                        />
                        <Text
                          style={[styles.attachButtonText, isProcessing ? {color: uiThemeColors.$textSecondary} : null]}>
                          Add Attachment
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={styles.separator}/>
              </ScrollView>

              <KeyboardSpacerIOS/>

              {isAttachFileDialogVisible && this.renderAttachFileDialog(uiTheme)}
            </View>
          );
        }}
      </ThemeContext.Consumer>
    );
  }
}

const mapStateToProps = (state, ownProps) => {
  return {
    ...state.creation,
    predefinedDraftId: ownProps.predefinedDraftId,
    issuePermissions: state.app.issuePermissions
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    ...bindActionCreators(createIssueActions, dispatch),
    getAttachActions: () => attachmentActions.createAttachActions(dispatch)
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(CreateIssue);
