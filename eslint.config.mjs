import { defineESLintConfig } from '@ocavue/eslint-config'

export default defineESLintConfig(
  {
    react: true,
  },
  {
    ignores: [
      'eslint.config.*',
      'src-tauri/gen/**',
      'dist/**',
      'node_modules/**',
    ],
  },
  {
    rules: {
      // Require curly braces for all control statements
      curly: ['error', 'all'],
    },
  },
)
