import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-electron', 'node_modules', 'playwright-report', 'test-results', '.hoplite'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['src/core/**/*.ts', 'src/editor/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*', 'react', 'react-dom', 'electron', 'zustand'],
              message: 'core and editor must stay framework free',
            },
            {
              group: ['**/ui/*', '**/renderer/*', '**/app/*', '**/platform/*'],
              message: 'core and editor must not depend on outer layers',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['electron', 'node:*'], message: 'use the platform adapter instead' }] },
      ],
    },
    ignores: ['src/core/**', 'src/editor/**', 'src/**/*.test.ts'],
  },
  {
    files: ['electron/**', 'scripts/**', '*.config.*', 'e2e/**'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
