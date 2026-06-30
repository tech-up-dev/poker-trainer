import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

// Project preference: no em dashes in code or comments. This local rule scans the
// raw source text so it catches them anywhere: string literals, JSX text, and
// comments alike. Use a regular hyphen or rephrase instead.
const noEmDash = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow the em dash character (U+2014)' },
  },
  create(context) {
    const source = context.sourceCode ?? context.getSourceCode()
    return {
      Program(node) {
        const text = source.getText()
        const pattern = /—/g
        let match
        while ((match = pattern.exec(text)) !== null) {
          const start = source.getLocFromIndex(match.index)
          context.report({
            node,
            loc: { start, end: { line: start.line, column: start.column + 1 } },
            message:
              'Em dash (U+2014) is not allowed; use a regular hyphen or rephrase.',
          })
        }
      },
    }
  },
}

export default defineConfig([
  // Deno Edge Functions are linted by Deno, not this browser/React config.
  globalIgnores(['dist', 'supabase/functions/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Turn off ESLint formatting rules that would conflict with Prettier.
      prettier,
    ],
    plugins: {
      local: { rules: { 'no-em-dash': noEmDash } },
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'local/no-em-dash': 'error',
    },
  },
])
