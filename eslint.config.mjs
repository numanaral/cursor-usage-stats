import jsPlugin from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";
import globals from "globals";
import tsEslint from "typescript-eslint";

import requireMultilineArrowBraces from "./development/eslint-rules/require-multiline-arrow-braces.mjs";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "out/**",
      ".vscode/**",
      ".cursor/**",
      ".vscode-test/**",
    ],
  },
  jsPlugin.configs.recommended,
  ...tsEslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: {
      prettier: prettierPlugin,
      import: importPlugin,
      "local-rules": {
        rules: {
          "require-multiline-arrow-braces": requireMultilineArrowBraces,
        },
      },
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // =======================================================================
      // # Prettier
      // =======================================================================
      // Run Prettier as an ESLint rule.
      "prettier/prettier": "error",

      // =======================================================================
      // # TypeScript
      // =======================================================================
      // Allow empty interfaces for extension points.
      "@typescript-eslint/no-empty-object-type": "off",

      // Enforces inline type imports.
      // ✅ import { type Foo } from "./foo";
      // ❌ import type { Foo } from "./foo";
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],

      // Allow unused vars if prefixed with underscore.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // =======================================================================
      // # Function style
      // =======================================================================
      // Enforces arrow function expressions over function declarations/expressions.
      // ✅ const add = (a, b) => a + b;
      // ❌ function add(a, b) { return a + b; }
      // ❌ const add = function(a, b) { return a + b; };
      "func-style": ["error", "expression", { allowArrowFunctions: true }],

      // Requires arrow functions for callbacks.
      // ✅ [1, 2, 3].map(x => x * 2);
      // ❌ [1, 2, 3].map(function(x) { return x * 2; });
      "prefer-arrow-callback": "error",

      // Custom rule: Enforces braces for multi-line arrow functions.
      // Single-line can omit braces (implicit return).
      // Multi-line must use braces with explicit return.
      // ✅ const a = () => 5;
      // ✅ const b = () => { return x; };
      // ❌ Multi-line without braces (auto-fixed)
      "local-rules/require-multiline-arrow-braces": "error",

      // Blocks function declarations and function expressions entirely.
      // Forces usage of arrow functions only.
      // ❌ function myFunc() {}
      // ❌ const myFunc = function() {};
      "no-restricted-syntax": [
        "error",
        {
          selector: "FunctionDeclaration",
          message:
            "Function declarations are not allowed. Use arrow functions instead.",
        },
        {
          selector: "FunctionExpression",
          message:
            "Function expressions are not allowed. Use arrow functions instead.",
        },
      ],

      // =======================================================================
      // # Imports
      // =======================================================================
      // Enforces inline type imports.
      "import/consistent-type-specifier-style": ["error", "prefer-inline"],

      // Prevents duplicate imports.
      "import/no-duplicates": ["error", { "prefer-inline": true }],

      // Keeps imports sorted and grouped.
      "import/order": [
        "error",
        {
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
          pathGroups: [
            {
              pattern: "vscode",
              group: "builtin",
              position: "before",
            },
            {
              pattern: "./**",
              group: "sibling",
              position: "after",
            },
          ],
          distinctGroup: false,
          pathGroupsExcludedImportTypes: ["type"],
          groups: [
            "builtin",
            "external",
            "internal",
            ["sibling", "parent"],
            "index",
            "object",
            "type",
            "unknown",
          ],
          warnOnUnassignedImports: true,
        },
      ],
    },
  },
  // Prettier config must be last to disable conflicting ESLint rules.
  prettierConfig,
];
