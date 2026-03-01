if (typeof Intl === 'undefined' || typeof Intl.PluralRules === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../node_modules/intl-pluralrules/polyfill');
}

export {};
