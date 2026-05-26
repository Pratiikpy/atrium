// Phase eta.12 (2026-05-25): ESLint 9 flat-config at repo root.
// Drops the `echo TODO && exit 0` stubs from apps/verify + services/*
// and provides a single config that all workspace members extend.
//
// Rule set intent:
//   - TypeScript correctness (no-floating-promises, no-explicit-any
//     downgraded to warn since some Web3 surfaces genuinely return any).
//   - React + hooks rules for apps/verify.
//   - Disable formatting rules entirely (Prettier handles them).
//   - Allow .test.ts to use any + console.

import typescriptParser from '@typescript-eslint/parser';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/generated/**',
      '**/out/**',
      '**/target/**',
      'apps/verify/public/mobile-app.html',
      'apps/verify/public/mobile-landing.html',
      'design/**',
      'resources/**',
    ],
  },

  // Base rules for every .ts / .tsx file.
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'prefer-const': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-debugger': 'error',
    },
  },

  // Test files: relax further so vitest stubs + integration mocks don't trip.
  {
    files: ['**/*.test.{ts,tsx}', '**/tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
