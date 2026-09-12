/**
 * ESLint config for @approvaliq/approval-engine.
 *
 * Extends the repo-wide config and adds the single rule that matters most for
 * this package: it must stay a pure, self-contained TypeScript interpreter.
 *
 * Implementation: everything is banned *except* relative imports and a small
 * allow-list. `regex` is used (not `group` globs, whose `ignore`-style
 * semantics are delimiter-sensitive and were empirically wrong for scoped
 * packages):
 *
 * - `^[./]` — sibling engine files via relative paths
 *   (`./types`, `./evaluate`, `../…`; REQUIRED for engine code to link).
 * - `^@approvaliq/domain-types($|/)` — the only runtime dependency.
 * - `^node:(test|assert($|/))` — the standalone `node:test` runner, allowed
 *   only inside `test/**` (Node built-ins, not packages).
 *
 * `allowTypeImports: true` on every banned pattern means `@types/node` (a
 * dev-only type package) still type-checks while any *runtime* coupling to a
 * banned module is an error.
 */
import baseConfig from '../../eslint.config.mjs';

const ONLY_TYPES_AND_DOMAIN =
  'approval-engine is a pure TS package: only @approvaliq/domain-types (and relative engine modules) are importable here. NestJS, database clients, HTTP clients, and LLM SDKs are banned.';
const ONLY_RUNNER =
  'approval-engine tests may only import the engine, @approvaliq/domain-types, and the node:test/node:assert runner.';

export default [
  ...baseConfig,
  {
    name: 'approval-engine/no-external-runtime-imports',
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?![./]|@approvaliq/domain-types($|/))',
              allowTypeImports: true,
              message: ONLY_TYPES_AND_DOMAIN,
            },
          ],
        },
      ],
    },
  },
  {
    name: 'approval-engine/test-runner-allowlist',
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?![./]|@approvaliq/domain-types($|/)|node:(test|assert($|/)))',
              allowTypeImports: true,
              message: ONLY_RUNNER,
            },
          ],
        },
      ],
    },
  },
];
