import js from '@eslint/js';
import globals from 'globals';

const HTML_SINK_MESSAGE = 'Build DOM with el() from js/utils/dom.js instead (SEC-01/02).';

export default [
  js.configs.recommended,
  {
    rules: {
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^(inner|outer)HTML$/]',
          message: HTML_SINK_MESSAGE,
        },
        {
          selector: 'MemberExpression[property.value=/^(inner|outer)HTML$/]',
          message: HTML_SINK_MESSAGE,
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: HTML_SINK_MESSAGE,
        },
        {
          selector:
            "CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]",
          message: HTML_SINK_MESSAGE,
        },
      ],
    },
  },
  {
    files: ['js/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['js/views/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/services/*', '**/data/*'],
              message: 'Views only read the Store and call controller handlers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['js/worker/**/*.js'],
    languageOptions: { globals: globals.worker },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'The worker uses only its own files, nothing from the page.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.js', 'eslint.config.js'],
    ignores: ['tests/perf.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['tests/perf.js'],
    languageOptions: { globals: globals.browser },
  },
];
