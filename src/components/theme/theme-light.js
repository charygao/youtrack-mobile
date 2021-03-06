/* @flow */

import type {UITheme} from '../../flow/Theme';

const light: UITheme = {
  dark: false,
  mode: 'ytlight',
  name: 'light',
  barStyle: 'dark-content',
  androidSummaryFontWeight: '500',

  colors: {
    $background: '#FFFFFF',
    $boxBackground: '#f3f3f3',

    $error: '#dd0000',

    $text: '#000000',
    $textSecondary: '#CCC',
    $textButton: '#FFF',

    $link: '#FF008C',
    $linkLight: 'rgba(254, 0, 130, 0.3)',

    $disabled: '#e9e9e9',

    $icon: '#737577',
    $iconAccent: '#b8d1e5',

    $mask: '#00000057',
    $navigation: '#737577',

    $separator: '#dfe5eb'
  },
};

export default light;
