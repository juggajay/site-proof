import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'public/',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite(),
  {
    files: ['src/**/*.{ts,tsx}'],
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
      'no-useless-catch': 'warn',
      'no-useless-escape': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: [
            'HELP_CONTENT',
            'CURRENT_APP_VERSION',
            'useChangelog',
            'useContextHelp',
            'useCookieConsent',
            'withErrorBoundary',
            'useKeyboardShortcutsHelp',
            'useOnboarding',
            'isAdminRole',
            'canViewCommercialData',
            'useFilterSheet',
            'badgeVariants',
            'buttonVariants',
            'toast',
            'useToast',
            'ToastProvider',
            'setGlobalToast',
            'usePullToRefresh',
            'useAuth',
            'getAuthToken',
            'getCurrentUser',
            'getRoleOverride',
            'getAuthStorage',
            'useDateFormat',
            'useTheme',
            'TIMEZONES',
            'useTimezone',
            'COLUMN_CONFIG',
            'DEFAULT_COLUMN_ORDER',
            'STATUS_OPTIONS',
          ],
        },
      ],
      'react-hooks/rules-of-hooks': 'warn',
    },
  },
  {
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        process: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  eslintConfigPrettier,
);
