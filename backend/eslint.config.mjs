import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'prisma/', 'uploads/', 'logs/'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-unused-vars': 'off',
      'no-console': 'off',
      'prefer-const': 'warn',
      // Downgraded from error → warn for pre-existing violations (brownfield)
      'no-case-declarations': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
    },
  },
  {
    files: [
      'scripts/migrate.ts',
      'scripts/preflight-production-integrations.ts',
      'scripts/check-migration-drift.mjs',
      'scripts/seed-e2e.mjs',
      'scripts/smoke-production.mjs',
    ],
    languageOptions: {
      globals: {
        AbortController: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  eslintConfigPrettier,
);
