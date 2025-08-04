import { defineESLintConfig } from '@ocavue/eslint-config'

export default defineESLintConfig(
  {
    react: true,
  },
  {
    rules: {
      // Require curly braces for all control statements
      curly: ['error', 'all'],
    },
  },
)
