/* @flow */
/**
 * https://confluence.jetbrains.com/display/TSYS/Issue+access+rights
 */
import type {AnyIssue} from '../../flow/Issue';
import type {Article} from '../../flow/Article';
import type {PermissionsStore} from '../permissions-store/permissions-store';
import type {User} from '../../flow/User';
import type {CustomField, IssueComment, IssueProject} from '../../flow/CustomFields';

export const CREATE_ISSUE = 'JetBrains.YouTrack.CREATE_ISSUE';
export const READ_ISSUE = 'JetBrains.YouTrack.READ_ISSUE';
export const UPDATE_ISSUE = 'JetBrains.YouTrack.UPDATE_ISSUE';
export const PRIVATE_UPDATE_ISSUE = 'JetBrains.YouTrack.PRIVATE_UPDATE_ISSUE';
export const CAN_CREATE_COMMENT = 'JetBrains.YouTrack.CREATE_COMMENT';
export const CAN_ADD_ATTACHMENT = 'JetBrains.YouTrack.CREATE_ATTACHMENT_ISSUE';
export const CAN_REMOVE_ATTACHMENT = 'JetBrains.YouTrack.DELETE_ATTACHMENT_ISSUE';
export const CAN_UPDATE_COMMENT = 'JetBrains.YouTrack.UPDATE_COMMENT';
export const CAN_UPDATE_NOT_OWN_COMMENT = 'JetBrains.YouTrack.UPDATE_NOT_OWN_COMMENT';
export const CAN_DELETE_COMMENT = 'JetBrains.YouTrack.DELETE_COMMENT';
export const CAN_DELETE_NOT_OWN_COMMENT = 'JetBrains.YouTrack.DELETE_NOT_OWN_COMMENT';
export const CAN_LINK_ISSUE = 'JetBrains.YouTrack.LINK_ISSUE';
export const CAN_UPDATE_WATCH = 'JetBrains.YouTrack.UPDATE_WATCH_FOLDER';

export const CREATE_ARTICLE = 'JetBrains.YouTrack.CREATE_ARTICLE';
export const UPDATE_ARTICLE = 'JetBrains.YouTrack.UPDATE_ARTICLE';
export const DELETE_ARTICLE = 'JetBrains.YouTrack.DELETE_ARTICLE';
export const READ_ARTICLE_COMMENT = 'JetBrains.YouTrack.READ_ARTICLE_COMMENT';
export const CREATE_ARTICLE_COMMENT = 'JetBrains.YouTrack.CREATE_ARTICLE_COMMENT';
export const UPDATE_ARTICLE_COMMENT = 'JetBrains.YouTrack.UPDATE_ARTICLE_COMMENT';
export const DELETE_ARTICLE_COMMENT = 'JetBrains.YouTrack.DELETE_ARTICLE_COMMENT';

export const WORK_ITEM_CREATE = 'JetBrains.YouTrack.CREATE_WORK_ITEM';
export const WORK_ITEM_UPDATE = 'JetBrains.YouTrack.UPDATE_WORK_ITEM';


export default class IssuePermissions {
  permissionsStore: PermissionsStore;
  currentUser: User;

  constructor(permissionsStore: PermissionsStore, currentUser: User) {
    this.permissionsStore = permissionsStore;
    this.currentUser = currentUser;
  }

  static getRingId(entity: Object): ?string {
    if (!entity || !entity.ringId) {
      return null;
    }
    return entity.ringId;
  }

  static getIssueProjectRingId(entity: AnyIssue): ?string {
    if (!entity || !entity.project) {
      return null;
    }
    return this.getRingId(entity.project);
  }

  hasPermissionFor = (entity: AnyIssue | Article, permissionName: string): boolean => {
    const projectRingId = IssuePermissions.getIssueProjectRingId(entity);
    return !!projectRingId && this.permissionsStore.has(permissionName, projectRingId);
  };

  isCurrentUser = (user: User): boolean => {
    if (!user || !user.ringId || !this.currentUser || !this.currentUser.id) {
      return false;
    }

    return user.ringId === this.currentUser.id;
  };

  canUpdateGeneralInfo = (issue: ?AnyIssue): boolean => {
    if (!issue) {
      return false;
    }

    if (this.hasPermissionFor(issue, READ_ISSUE) && this.hasPermissionFor(issue, UPDATE_ISSUE)) {
      return true;
    }

    return this.isCurrentUser(issue?.reporter) && this.hasPermissionFor(issue, CREATE_ISSUE);
  };

  _canUpdatePublicField = (issue: ?AnyIssue): boolean => {
    if (this.isCurrentUser(issue?.reporter) && this.hasPermissionFor(issue, CREATE_ISSUE)) {
      return true;
    }
    return this.hasPermissionFor(issue, UPDATE_ISSUE);
  };

  _canUpdatePrivateField = (issue: AnyIssue): boolean => this.hasPermissionFor(issue, PRIVATE_UPDATE_ISSUE);

  _isBlockedByTimeTracking = (issue: AnyIssue, field: CustomField): boolean => {
    if (!issue.project || !issue.project.plugins) {
      return false;
    }

    const {timeTrackingSettings} = issue.project.plugins;
    if (
      !timeTrackingSettings ||
      !timeTrackingSettings.enabled ||
      !timeTrackingSettings.timeSpent
    ) {
      return false;
    }
    const isSpentTime = timeTrackingSettings.timeSpent.field.id === field.projectCustomField.field.id;

    return isSpentTime; // Spent Time field is always disabled to edit – calculating automatically
  };

  canUpdateField = (issue: AnyIssue, field: CustomField): boolean => {
    if (!issue) {
      return false;
    }
    if (this._isBlockedByTimeTracking(issue, field)) {
      return false;
    }
    if (field.projectCustomField && field.projectCustomField.isPublic) {
      return this._canUpdatePublicField(issue);
    }
    return this._canUpdatePrivateField(issue);
  };

  canCommentOn = (issue: AnyIssue): boolean => this.hasPermissionFor(issue, CAN_CREATE_COMMENT);

  canUpdateComment = (
    entity: AnyIssue | Article,
    comment: IssueComment,
    canUpdateCommentPermissionName: string = CAN_UPDATE_COMMENT
  ): boolean => {
    if (!entity) {
      return false;
    }
    if (this.isCurrentUser(comment.author)) {
      return this.hasPermissionFor(entity, canUpdateCommentPermissionName);
    }
    return this.hasPermissionFor(entity, CAN_UPDATE_NOT_OWN_COMMENT);
  };

  canDeleteNotOwnComment = (issue: AnyIssue): boolean => this.hasPermissionFor(issue, CAN_DELETE_NOT_OWN_COMMENT);

  canDeleteComment = (
    entity: AnyIssue | Article, comment: IssueComment,
    canDeleteCommentPermissionName: string = CAN_DELETE_COMMENT
  ): boolean => {
    if (!entity) {
      return false;
    }
    if (this.isCurrentUser(comment.author)) {
      return this.hasPermissionFor(entity, canDeleteCommentPermissionName);
    }
    return this.canDeleteNotOwnComment(entity);
  };

  canRestoreComment = (issue: AnyIssue, comment: IssueComment): boolean => {
    return this.canDeleteComment(issue, comment) || this.canUpdateComment(issue, comment);
  };

  canDeleteCommentPermanently = (issue: AnyIssue): boolean => this.canDeleteNotOwnComment(issue);

  canAddAttachmentTo = (issue: AnyIssue): boolean => this.hasPermissionFor(issue, CAN_ADD_ATTACHMENT);

  canRemoveAttachment = (issue: AnyIssue): boolean => this.hasPermissionFor(issue, CAN_REMOVE_ATTACHMENT);

  canCreateIssueToProject = (project: IssueProject): boolean => {
    return this.hasPermissionFor({project: project}, CAN_CREATE_COMMENT);
  };

  canVote = (issue: AnyIssue): boolean => (
    !!issue && !!this.currentUser && !this.isCurrentUser(issue?.reporter) && !this.currentUser.guest
  );

  canTag = (issue: AnyIssue): boolean => (
    this.hasPermissionFor(issue, PRIVATE_UPDATE_ISSUE) ||
    this.hasPermissionFor(issue, CAN_UPDATE_WATCH)
  );

  canStar = (): boolean => !this.currentUser?.guest;

  canRunCommand = (issue: AnyIssue): boolean => {
    const has = (...args) => this.permissionsStore.has(...args);

    return this.isCurrentUser(issue.reporter) || hasAnyPermission();

    function hasAnyPermission(): boolean {
      const projectRingId = IssuePermissions.getIssueProjectRingId(issue);

      return !!projectRingId && (
        has(CAN_CREATE_COMMENT, projectRingId) ||
        has(UPDATE_ISSUE, projectRingId) ||
        has(PRIVATE_UPDATE_ISSUE, projectRingId) ||
        has(CAN_LINK_ISSUE, projectRingId) ||
        has(CAN_UPDATE_WATCH, projectRingId)
      );
    }
  };

  canCreateWork = (entity: AnyIssue): boolean => (
    this.hasPermissionFor(entity, WORK_ITEM_UPDATE) ||
    this.hasPermissionFor(entity, WORK_ITEM_CREATE)
  );

  /*
   Articles
   */
  canUpdateArticle = (article: Article): boolean => {
    if (!article) {
      return false;
    }
    if (this.isCurrentUser(article.reporter)) {
      return true;
    }
    return this.hasPermissionFor(article, UPDATE_ARTICLE);
  };

  articleCanCommentOn = (article: Article): boolean => this.hasPermissionFor(article, CREATE_ARTICLE_COMMENT);

  articleCanUpdateComment = (article: Article, comment: IssueComment): boolean => {
    return this.canUpdateComment(article, comment, UPDATE_ARTICLE_COMMENT);
  };

  articleCanDeleteComment = (article: Article, comment: IssueComment): boolean => {
    return this.canDeleteComment(article, comment, DELETE_ARTICLE_COMMENT);
  };

  articleCanCreateArticle = (projectRingId?: string) => (
    this.permissionsStore.has(CREATE_ARTICLE, projectRingId)
  )

  articleCanDeleteArticle = (projectRingId?: string) => (
    this.permissionsStore.has(DELETE_ARTICLE, projectRingId)
  )
}
