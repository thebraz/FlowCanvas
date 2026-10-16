import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import a11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
const restrictedSyntax = [
  { selector: "CallExpression[callee.name='eval']", message: 'Executable data is prohibited.' },
  { selector: "NewExpression[callee.name='Function']", message: 'Executable data is prohibited.' },
  { selector: "CallExpression[callee.name='Function']", message: 'Executable data is prohibited.' },
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'Render untrusted content as text.',
  },
];
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-benchmark/**',
      'coverage/**',
      '.tmp/**',
      'docs/reports/evidence/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        allowDefaultProject: ['*.js', 'scripts/*.mjs'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-syntax': ['error', ...restrictedSyntax],
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': hooks, 'jsx-a11y': a11y },
    rules: { ...hooks.configs.recommended.rules, ...a11y.configs.recommended.rules },
  },
  {
    files: ['src/domain/**/*.ts', 'src/contracts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-dom',
                '@xyflow/*',
                'zustand',
                'zustand/*',
                'zod',
                '**/state/*',
                '**/application/*',
                '**/adapters/*',
                '**/ui/*',
                '**/validation/*',
              ],
              message: 'Domain/contracts are framework independent.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'indexedDB',
        'fetch',
        'Worker',
        'HTMLElement',
        'navigator',
      ],
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                '@xyflow/*',
                'zustand',
                'zustand/*',
                '**/state/*',
                '**/application/*',
                '**/adapters/*',
                '**/features/*',
                '**/ui/*',
              ],
              message: 'Engine imports only pure contracts, domain and validation.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'indexedDB',
        'fetch',
        'WebSocket',
        'XMLHttpRequest',
        'Worker',
        'MessageChannel',
        'performance',
        'setTimeout',
        'setInterval',
        'Date',
        'crypto',
      ],
    },
  },
  {
    files: ['*.js', 'scripts/*.mjs'],
    languageOptions: { parserOptions: { projectService: false } },
    extends: [tseslint.configs.disableTypeChecked],
    rules: { 'no-console': 'off' },
  },
);
