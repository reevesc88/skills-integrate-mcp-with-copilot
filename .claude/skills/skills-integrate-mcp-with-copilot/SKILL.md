```markdown
# skills-integrate-mcp-with-copilot Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill demonstrates how to integrate MCP (Managed Control Plane) with GitHub Copilot using TypeScript. It covers repository structure, coding conventions, and common workflows for developing and maintaining code in this project. The repository follows clear commit and code style conventions to ensure maintainability and consistency.

## Coding Conventions

### File Naming
- Use **kebab-case** for all file names.
  - Example: `my-component.ts`, `user-service.test.ts`

### Import Style
- Use **relative imports** for all modules.
  - Example:
    ```typescript
    import { myFunction } from './utils';
    ```

### Export Style
- Use **named exports** rather than default exports.
  - Example:
    ```typescript
    // utils.ts
    export function myFunction() { ... }
    ```

### Commit Messages
- Use **Conventional Commits** with the `feat` prefix for new features.
  - Example: `feat: add integration with MCP API`

## Workflows

### MCP Integration Development
**Trigger:** When developing or updating MCP integration features  
**Command:** `/mcp-integration`

1. Create a new feature branch.
2. Implement the feature in TypeScript, following coding conventions.
3. Use relative imports and named exports.
4. Write or update corresponding test files (`*.test.ts`).
5. Commit changes using the `feat` prefix and a concise message.
6. Open a pull request for review.

### Testing
**Trigger:** When adding or updating code  
**Command:** `/run-tests`

1. Identify or create a test file matching the pattern `*.test.ts`.
2. Write tests for new or updated code.
3. Run the test suite using the project's test runner (framework unknown; check project scripts).
4. Ensure all tests pass before committing.

## Testing Patterns

- Test files are named with the pattern `*.test.ts`.
- The testing framework is not explicitly defined; check for scripts or documentation in the repository.
- Example test file:
  ```typescript
  // my-function.test.ts
  import { myFunction } from './my-function';

  describe('myFunction', () => {
    it('should return expected result', () => {
      expect(myFunction()).toBe('expected');
    });
  });
  ```

## Commands
| Command           | Purpose                                      |
|-------------------|----------------------------------------------|
| /mcp-integration  | Start or update MCP integration development  |
| /run-tests        | Run the test suite for the project           |
```
