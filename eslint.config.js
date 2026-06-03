'use strict';

const js = require('@eslint/js');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '**/node_modules/**',
      'adapters/claude-code/core/**',
      'adapters/claude-code/shared/**',
      'core/vendor/**',
      'core/test/snapshots/__golden__/**',
      'coverage/**',
      'dist/**',
      'build/**'
    ]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        globalThis: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-implicit-globals': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'eqeqeq': ['warn', 'smart'],
      'no-throw-literal': 'error',
      'no-self-assign': 'error',
      'no-unreachable': 'error'
    }
  },
  {
    files: ['core/assets/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        sessionStorage: 'readonly',
        localStorage: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        CSS: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        module: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-var': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
      'eqeqeq': ['warn', 'smart'],
      'no-throw-literal': 'error',
      'no-self-assign': 'error',
      'no-unreachable': 'error'
    }
  }
];
