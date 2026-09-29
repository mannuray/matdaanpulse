import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/components/**', 'src/hooks/**', 'src/services/**', 'src/utils/**', 'src/types/**', 'src/pages/Dashboard.tsx', 'src/pages/ConstituencyDetail.tsx', 'src/pages/PersonDetail.tsx', 'src/theme/ThemeProvider.tsx', 'e2e/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, import: importPlugin },
    settings: { 'import/resolver': { typescript: true, node: { extensions: ['.ts', '.tsx'] } } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'import/no-restricted-paths': ['error', {
        zones: [
          { target: './src/model', from: ['./src/viewmodels', './src/views', './src/pages'], message: 'Model must not depend on ViewModels/Views.' },
          { target: './src/viewmodels', from: ['./src/views', './src/pages'], message: 'ViewModels must not depend on Views.' },
          { target: './src/views', from: ['./src/model/api', './src/model/derive', './src/model/live', './src/viewmodels/data', './src/pages'], message: 'Views only consume ViewModel output (types from model/types are fine).' },
        ],
      }],
    },
  },
);
