/* @flow */
import {createReducer} from 'redux-create-reducer';
import * as types from './issues-action-types';
import {LOG_OUT} from '../../actions/action-types';
import {ISSUE_CREATED} from '../create-issue/create-issue-action-types';
import {ISSUE_UPDATED} from '../issue/issue-action-types';
import type {IssueOnList, IssueFull, TransformedSuggestions} from '../../flow/Issue';
import type {Folder} from '../../flow/User';

export type IssuesState = {
  query: string,
  skip: number,
  queryAssistSuggestions: Array<TransformedSuggestions>,

  isLoadingMore: boolean,
  isListEndReached: boolean,
  loadingError: ?Object,
  isInitialized: boolean,
  isRefreshing: boolean,
  isIssuesContextOpen: boolean,

  issuesCount: number | null,
  issues: Array<IssueOnList>,

  selectProps: Object,
  searchContext: ?Folder,
  isSearchContextPinned: boolean
};

export const initialState: IssuesState = {
  query: '',
  queryAssistSuggestions: [],
  skip: 0,
  isLoadingMore: false,
  isListEndReached: false,

  loadingError: null,
  isInitialized: false,
  isRefreshing: false,
  isIssuesContextOpen: false,
  issuesCount: null,
  issues: [],

  selectProps: null,
  searchContext: null,
  isSearchContextPinned: false
};

export default createReducer(initialState, {
  [LOG_OUT]: (state: IssuesState): IssuesState => {
    return initialState;
  },
  [ISSUE_CREATED]: (state: IssuesState, action: {issue: IssueFull}): IssuesState => {
    return {...state, issues: [action.issue, ...state.issues]};
  },
  [types.SET_ISSUES_QUERY]: (state: IssuesState, action: Object) => {
    return {...state, query: action.query};
  },
  [types.SUGGEST_QUERY]: (state: IssuesState, action: Object) => {
    return {...state, queryAssistSuggestions: action.suggestions};
  },
  [types.CLEAR_SUGGESTIONS]: (state: IssuesState, action: Object) => {
    return {...state, queryAssistSuggestions: []};
  },
  [types.START_ISSUES_LOADING]: (state: IssuesState, action: Object) => {
    return {
      ...state, loadingError: null, isListEndReached: false, isRefreshing: true, skip: 0
    };
  },
  [types.STOP_ISSUES_LOADING]: (state: IssuesState, action: Object) => {
    return {...state, isRefreshing: false};
  },
  [types.START_LOADING_MORE]: (state: IssuesState, action: Object) => {
    return {...state, isLoadingMore: true, skip: action.newSkip};
  },
  [types.STOP_LOADING_MORE]: (state: IssuesState, action: Object) => {
    return {...state, isLoadingMore: false};
  },
  [types.RECEIVE_ISSUES]: (state: IssuesState, action: {issues: Array<IssueOnList>, pageSize: number}) => {
    return {
      ...state,
      issues: action.issues,
      isInitialized: true
    };
  },
  [types.LOADING_ISSUES_ERROR]: (state: IssuesState, action: {error: Object}) => {
    return {
      ...state,
      isInitialized: true,
      isListEndReached: true,
      loadingError: action.error,
      issues: []
    };
  },
  [types.LIST_END_REACHED]: (state: IssuesState, action: {error: Object}) => {
    return {...state, isListEndReached: true};
  },
  [types.SET_ISSUES_COUNT]: (state: IssuesState, action: {count: number}) => {
    return {...state, issuesCount: action.count};
  },
  [types.RESET_ISSUES_COUNT]: (state: IssuesState, action: {count: number}) => {
    return {...state, issuesCount: null};
  },
  [ISSUE_UPDATED]: (state: IssuesState, action: {issue: IssueFull}) => {
    const sourceIssue = action.issue;
    function updateIssue(issue: IssueOnList): IssueOnList {
      return Object.keys(issue).
        reduce((updated, key) => {
          return {...updated, [key]: sourceIssue[key]};
        }, {});
    }

    const issues = state.issues.map(issue => issue.id === sourceIssue?.id ? updateIssue(issue) : issue);

    return {...state, issues};
  },
  [types.OPEN_SEARCH_CONTEXT_SELECT](state: IssuesState, action: Object): IssuesState {
    return {
      ...state,
      selectProps: action.selectProps,
      isIssuesContextOpen: true
    };
  },
  [types.CLOSE_SEARCH_CONTEXT_SELECT](state: IssuesState): IssuesState {
    return {
      ...state,
      selectProps: null,
      isIssuesContextOpen: false
    };
  },
  [types.IS_SEARCH_CONTEXT_PINNED](state: IssuesState, action: Object): IssuesState {
    return {
      ...state,
      isSearchContextPinned: action.isSearchContextPinned
    };
  },
});
