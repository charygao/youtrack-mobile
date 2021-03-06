/* @flow */

import {createAttachmentTypes, attachmentActionMap} from '../../components/attachments-row/attachment-types';
import {getAttachmentActions} from '../../components/attachments-row/attachment-actions';

const PREFIX: string = 'articleCreate';

export const attachmentTypes: typeof attachmentActionMap = createAttachmentTypes(PREFIX);
export const attachmentActions = getAttachmentActions(PREFIX);
