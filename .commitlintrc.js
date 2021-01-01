const config = require('@commitlint/config-conventional');

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [...config.rules['type-enum'][2], 'wip']]
  }
};
