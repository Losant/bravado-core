import nodeConfig from '@losant/eslint-config-losant/env/node.js';

export default [
  ...nodeConfig,
  {
    rules: {
      'guard-for-in': 'off'
    }
  }
];
