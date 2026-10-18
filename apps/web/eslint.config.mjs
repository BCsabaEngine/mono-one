// apps/web has its own config (Svelte rules); the module-boundary rules come from the shared module.
import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { boundaries } from '../../tools/eslint/boundaries.mjs'

export default [
	{ ignores: ['.svelte-kit', 'node_modules', '../../dist'] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs.recommended,
	{ languageOptions: { globals: { ...globals.browser, ...globals.node } } },
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'] } }
	},
	...boundaries,
	{ rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } }
]
