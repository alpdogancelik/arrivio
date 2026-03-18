if (typeof Intl === 'undefined' || typeof Intl.PluralRules === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('intl-pluralrules/polyfill');
}

export {};
