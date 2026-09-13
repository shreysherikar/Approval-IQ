/**
 * ESLint config for @approvaliq/storage.
 *
 * Extends the repo-wide config and restricts imports so this package stays a
 * portable storage seam: relative sibling modules and Node built-ins only. It
 * must NOT import NestJS, the database client, or any HTTP/cloud SDK (the S3
 * stub in particular must not pull in an AWS SDK yet — Phase 15 work).
 *
 * `allowTypeImports: true` on the banned pattern means `@types/node` (a dev-only
 * type package) still type-checks while any *runtime* coupling to a banned
 * module is an error.
 */
import baseConfig from '../../eslint.config.mjs';

const ONLY_NODE_AND_RELATIVE =
  'storage is a portable package: only relative modules and Node built-ins (node:fs/promises, node:path, node:crypto, ...) are importable here. NestJS, database clients, HTTP clients, and AWS/cloud SDKs are banned.';
const ONLY_RUNNER =
  'storage tests may only import the storage package and the node:test/node:assert runner.';

export default [
  ...baseConfig,
  {
    name: 'storage/no-external-runtime-imports',
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?![./]|node:($|.*))',
              allowTypeImports: true,
              message: ONLY_NODE_AND_RELATIVE,
            },
          ],
        },
      ],
    },
  },
  {
    name: 'storage/test-runner-allowlist',
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?![./]|node:(test|assert($|/))|node:(fs|path|crypto|os)($|/))',
              allowTypeImports: true,
              message: ONLY_RUNNER,
            },
          ],
        },
      ],
    },
  },
];