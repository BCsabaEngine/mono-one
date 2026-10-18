// Root config: core services and all libs. apps/web has its own eslint.config.mjs.
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { boundaries } from './tools/eslint/boundaries.mjs'

export default [
  { ignores: ['**/dist', '**/node_modules', '**/.svelte-kit', '**/.nx', 'apps/*/src/db/migrations', 'apps/web/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
  ...boundaries,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } }
]
