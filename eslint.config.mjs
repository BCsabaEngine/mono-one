// One flat config for the whole workspace: services, libs and apps/web (Svelte rules scoped to apps/web).
import js from '@eslint/js'
import nx from '@nx/eslint-plugin'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const scopes = {
  'scope:system': ['scope:system', 'scope:events'],
  'scope:customer': ['scope:customer', 'scope:events'],
  'scope:order': ['scope:order', 'scope:customer', 'scope:events'],
  'scope:document': [
    'scope:document',
    'scope:customer',
    'scope:order',
    'scope:events'
  ],
  'scope:web': [
    'scope:web',
    'scope:customer',
    'scope:order',
    'scope:document',
    'scope:system',
    'scope:events'
  ],
  'scope:events': ['scope:events']
}

const types = {
  'type:app': ['type:api', 'type:events'],
  'type:api': [],
  'type:events': []
}

const constraints = [...Object.entries(types), ...Object.entries(scopes)].map(
  ([sourceTag, onlyDependOnLibsWithTags]) => ({
    sourceTag,
    onlyDependOnLibsWithTags
  })
)

// the router and context type exported by `@api/<svc>` are only for the owning service app; everyone else may use the types and contract
const serviceApps = {
  customer: 'customer-service',
  order: 'order-service',
  document: 'document-service',
  system: 'system-service'
}

const contextNames = {
  customer: 'CustomerContext',
  order: 'OrderContext',
  document: 'DocumentContext',
  system: 'SystemContext'
}

const serverOnlyRule = libs => [
  'error',
  {
    patterns: libs.map(lib => ({
      group: [`@api/${lib}`],
      importNames: ['appRouter', contextNames[lib]],
      message: 'The router and context are only for the owning service app.'
    }))
  }
]

const web = ['apps/web/**']

export default [
  {
    ignores: [
      '**/dist',
      '**/node_modules',
      '**/.svelte-kit',
      '**/.nx',
      'apps/*/src/db/migrations'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended.map(c => ({ ...c, files: c.files ?? web })),
  { languageOptions: { globals: globals.node } },
  { files: web, languageOptions: { globals: globals.browser } },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte']
      }
    }
  },
  {
    files: ['**/*.ts', '**/*.mts', '**/*.js', '**/*.mjs', '**/*.svelte'],
    plugins: { '@nx': nx },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          allow: ['^#lib(/.*)?$'],
          depConstraints: constraints
        }
      ],
      // type-only imports must be top-level `import type`: `import { type X }` stays a side-effect import under verbatimModuleSyntax
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' }
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportSpecifier[importKind="type"]',
          message:
            'Use a separate top-level `import type { X }`, not `import { type X }`.'
        }
      ],
      'no-restricted-imports': serverOnlyRule(Object.keys(serviceApps))
    }
  },
  // lift the restriction inside each owning service app
  ...Object.entries(serviceApps).map(([lib, app]) => ({
    files: [`apps/${app}/**/*.ts`],
    rules: {
      'no-restricted-imports': serverOnlyRule(
        Object.keys(serviceApps).filter(l => l !== lib)
      )
    }
  })),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' }
      ]
    }
  }
]
