import nx from '@nx/eslint-plugin'

const scopes = {
  'scope:customer': ['scope:customer', 'scope:shared', 'scope:registry'],
  'scope:order': ['scope:order', 'scope:customer', 'scope:shared', 'scope:registry'],
  'scope:document': ['scope:document', 'scope:order', 'scope:shared', 'scope:registry'],
  'scope:web': ['scope:web', 'scope:customer', 'scope:order', 'scope:document', 'scope:shared', 'scope:registry'],
  'scope:shared': ['scope:shared'],
  'scope:registry': ['scope:registry', 'scope:shared', 'scope:order']
}

const types = {
  'type:app': ['type:api', 'type:contract', 'type:shared', 'type:registry', 'type:events-client'],
  'type:api': ['type:contract', 'type:shared'],
  'type:contract': ['type:contract', 'type:shared'],
  'type:shared': ['type:shared'],
  'type:registry': ['type:contract'],
  'type:events-client': ['type:shared', 'type:contract', 'type:registry']
}

const constraints = [...Object.entries(types), ...Object.entries(scopes)].map(
  ([sourceTag, onlyDependOnLibsWithTags]) => ({ sourceTag, onlyDependOnLibsWithTags })
)

// each service app may import its own `/server` entry point; everything else must use the types-only entry
const serviceApps = { customer: 'customer-service', order: 'order-service', document: 'document-service' }

export const boundaries = [
  {
    files: ['**/*.ts', '**/*.mts', '**/*.js', '**/*.mjs', '**/*.svelte'],
    plugins: { '@nx': nx },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        { enforceBuildableLibDependency: false, allow: ['^#lib(/.*)?$'], depConstraints: constraints }
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@mono/*-api/server'], message: 'The /server entry point is only for the owning service app.' }
          ]
        }
      ]
    }
  },
  { files: ['**/eslint.config.mjs'], rules: { '@nx/enforce-module-boundaries': 'off' } },
  // lift the /server restriction inside each owning service app
  ...Object.entries(serviceApps).map(([lib, app]) => ({
    files: [`apps/${app}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@mono/*-api/server', `!@mono/${lib}-api/server`],
              message: 'Only this service may import its own /server entry point.'
            }
          ]
        }
      ]
    }
  }))
]
