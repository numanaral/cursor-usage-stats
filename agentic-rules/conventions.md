# Conventions

## Important

- Be honest and if you aren't sure, it's better to say "I don't know" than guess, halt the
  conversation immediately.
- When asked for a change, if you are incapable of doing, or lacking access etc., halt the
  conversation immediately and let me know what the issue is.
- If you don't have enough context to give a confident answer, halt the conversation immediately and
  let me know what additional information you need.
- Don't leave comments without a period or any other punctuation mark in the end.
- Do not remove existing code or comments unless specifically asked to do so.

## General

- If asked for code examples or code changes or edits, don't provide explanation unless specifically
  asked for it. Directly provide the code.
- If you add a comment for backward compatibility, or some action you took based on user request, make it a TODO comment.
- Use a modular structure for projects, breaking down components and utilities into separate files
  and folders. Don't create large files unless asked for.
- Use a consistent naming convention for files and folders.
- When refactoring or asking for code changes, do not remove existing code unless specifically asked
  to do so. Instead, add new code or modify existing code as needed. Leave the comments in the code
  unless specifically asked to remove them, only update if necessary or delete if the comment is not
  relevant anymore.
- When fixing an error, don't just do backward compatible, ask to see if we can fix it.

## TypeScript

- Use `unknown` over `any` for unknown types.
- Avoid using `any` at all costs unless absolutely necessary. Better check with me first if you need to use it.
- Don't type the return types of functions unless it cannot be inferred or it needs to be casted,
  which should be done at the end of the function.
- If returning object / array, return `as const`.
- Prefer `interface` over `type` for object shapes. Use `type` for unions, mapped types, and function signatures.
- Use `as const` for enum-like objects instead of `enum`.
- Prefer `const` over `let`. Never use `var`.

## How to Write Code

- Export directly unless it's a module with a default export.
- Arrow functions should be used for all function expressions.
- Explicit return types should be used for all functions unless it can fit in a single line. e.g.:
  - `if (falseCondition) return;`
  - `const mappedValues = values.map((value) => value * 2);`
- Always make sure sentences end with a period or any other punctuation mark in comments.
  - This can also apply to strings where it makes sense.
- Prefer early returns to reduce nesting.

## Best Practices

- Do not use inline switch statements or functions to get such values unless there is a dependency on the value.
- Prefer using constants as mappings:

```ts
const StatusColor = {
  Active: "success",
  Inactive: "warning",
  Removed: "danger",
} as const;

// Access via bracket notation.
const statusColor = StatusColor[status];

// Or via dot notation.
StatusColor.Active; // "success"
```

## Linting

- See [agentic-rules/linting.md](linting.md).

## How to Write Comments

- Do not use we, I, you, etc.
- Start with a verb and use present tense on a third person. e.g.:
  - "Performs a calculation."
  - "Adds a new user to the database."
  - "Fetches data from the API."
- The first line / paragraph should be a short summary of the function.
- Details, notes and usage description should be in the next paragraph(s).
- Don't add comments to obvious code. Prefer better names over comments. Comments should only be
  used to explain complex logic or provide additional context.
- Use `//` for single line comments.
- Use `/** */` for multi-line comments.
- Use `/** */` for the constant if we are describing a constant.
- Use `@example` for examples.
- Use `@see` for references to other functions or components.

## Error Handling

- Always handle errors explicitly. Never swallow errors with empty catch blocks.
- Log errors with context (what was being attempted, relevant parameters).
- Prefer typed errors or error messages that help diagnose the issue.

## Naming Conventions

- `UPPER_SNAKE_CASE` for constants.
- `PascalCase` for types, interfaces, enums, and components.
- `camelCase` for variables, functions, and parameters.

## Folder Structure

```bash
src/
  moduleName/       # Feature modules (e.g. events/, tips/, alerts/).
    types.ts        # Interfaces and type definitions.
    api.ts          # API fetch functions.
    utils.ts        # Pure utility/helper functions.
    index.ts        # Barrel exports.
  constants.ts      # Shared constants and default config.
  types.ts          # Shared type definitions.
  utils.ts          # Shared utility functions.
  extension.ts      # Main extension entry point.
```

### Module `index.ts` structure

```ts
export * from "./api";
export * from "./utils";
export * from "./types";
```

### `constants.ts` structure

```ts
// Constants here.
// Prefer UPPER_SNAKE_CASE for constants.
export const SOME_CONSTANT = "SOME_CONSTANT";

// Enums here.
// Prefer `as const` for enum-like objects over `enum`.
// Enum keys should be in PascalCase and values should match the keys unless specified otherwise.
export const SomeEnum = {
  SomeValueA: "SomeValueA",
  SomeValueB: "SomeValueB",
} as const;
```

### `utils.ts` structure

````ts
// Utility functions here.
// Prefer using arrow functions and explicit return types.
// Use descriptive names for utility functions.
// Always add a good description for the utility function with some examples if possible, at least a few.
// If the parameters are obvious, don't need to describe them. Prefer better names over comments.
/**
 * Performs some utility function.
 *
 * @example
 * ```ts
 * exampleFunction("example"); // returns "example"
 * exampleFunction("another"); // returns "another"
 * ```
 */
export const exampleFunction = (param: string) => {
  // Utility logic here.

  return param;
};
// If the utility function is complex, we can break it down into smaller functions, and anything reusable in the app should be moved to a root utils folder.
````

### `types.ts` structure

```ts
// Types here.
// Prefer using `interface` over `type` for defining object types.
// Use descriptive names for types.
// Use PascalCase for type names.
// Use `type` for union types or other complex types.
// If possible, use generics to make the types more flexible.
// Mapped types are great for creating types based on existing types, if possible, use them.
// Prefer using `Record<string, unknown>` for object types with unknown keys or have it as generic.
export interface SomeDefinition {
  // Props here.
  // Ensure to add descriptive names for the properties.
  // Comments should be used to describe the properties if not obvious.
  propertyName: string;
  /**
   * Description of the property.
   *
   * Can be multi-line if needed.
   */
  anotherProperty: number;
}

// Use `type` for union types or other complex types.
export type SomeType = string | number | boolean;
// Use `type` for mapped types.
export type MappedType<T> = {
  [K in keyof T]: T[K];
};
// Use `type` for generic types.
export type GenericType<T> = {
  [key: string]: T;
};
// Use `type` for function types.
export type FunctionType = (param: string) => number;
```
