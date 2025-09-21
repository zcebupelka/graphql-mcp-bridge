---
layout: default
title: Home
nav_order: 1
description: "A powerful bridge implementation connecting GraphQL APIs with the Model Context Protocol"
permalink: /
---

# GraphQL MCP Bridge
{: .no_toc }

<!-- markdownlint-disable MD033 -->
[![CI](https://github.com/pshaddel/graphql-mcp-bridge/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pshaddel/graphql-mcp-bridge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/github/pshaddel/graphql-mcp-bridge/graph/badge.svg?token=5DNFYP8N97)](https://codecov.io/github/pshaddel/graphql-mcp-bridge)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![npm version](https://img.shields.io/npm/v/graphql-mcp-bridge.svg)](https://www.npmjs.com/package/graphql-mcp-bridge)

<div align="center">
  <img width="200" height="200" alt="logo-light" src="https://github.com/user-attachments/assets/fd1c1676-2486-41c1-bd8b-ba4250549ba8">
</div>

A powerful bridge implementation connecting GraphQL APIs with the Model Context Protocol (MCP), enabling seamless integration between GraphQL services and MCP-compatible AI systems. Transform any GraphQL schema into type-safe, validated MCP tools with intelligent field selection and comprehensive runtime validation powered by Zod.

<div align="center">
<img width="80%" alt="Screenshot 2025-09-14 at 01 04 08" src="https://github.com/user-attachments/assets/33b5f7d5-e93e-4ed3-b3e8-472f2441b95b#gh-dark-mode-only" />
<img width="80%" alt="Screenshot 2025-09-14 at 01 02 40" src="https://github.com/user-attachments/assets/836dc4a4-cedd-4b3c-abcd-8eb4d35dadd4#gh-light-mode-only" />
</div>

## Features

- 🔗 **GraphQL to MCP Bridge**: Convert GraphQL schemas to MCP-compatible function definitions
- 📝 **Description Preservation**: Automatically preserves GraphQL field descriptions as tool descriptions
- ⚙️ **Flexible Configuration**: Selective operation generation with customizable naming patterns
  - **Operation Type Control**: Choose which operation types to include (queries, mutations, subscriptions)
  - **Custom Prefixes**: Add prefixes to operation names for better organization
  - **Granular Control**: Fine-tune which operations are exposed as MCP tools
  - **Selective Tool Generation**: Skip operations using ignore phrases in descriptions
- 🛡️ **Comprehensive Zod Validation**:
  - **Input Validation**: Automatic validation of operation arguments with type-safe Zod schemas
  - **Output Selection Validation**: Validate field selection objects for GraphQL queries and mutations
  - **Nested Type Support**: Handle complex nested inputs, enums, interfaces, and union types
  - **Circular Reference Protection**: Safe handling of self-referencing types
- 🎯 **Smart Field Selection**:
  - Dynamic field selection with support for nested objects, unions, and interfaces
  - **Default Selection Generation**: Automatically select scalar and enum fields when no selection provided
  - **Strict Schema Validation**: Prevent selection of non-existent fields
- 🚀 **Query Generation**: Automatic GraphQL query string generation with variable handling
- 📝 **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- ⚙️ **Advanced Schema Support**: Handles enums, interfaces, unions, complex inputs, and nested types
- ⚡ **Runtime Safety**:
  - Built-in validation for all operations before execution
  - User-friendly error messages for validation failures
  - Fallback handling for edge cases and malformed data

## Installation

### From npm

```bash
npm install graphql-mcp-bridge
# or
pnpm install graphql-mcp-bridge
# or
yarn add graphql-mcp-bridge
```

That's it! No authentication or special configuration required.

## Quick Start

```typescript
import { schemaParser } from 'graphql-mcp-bridge';

// Define your GraphQL schema
const schema = `
  type User {
    id: ID!
    username: String!
    email: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
  }

  type Query {
    """
    Retrieves a user by their unique identifier
    """
    user(id: ID!): User

    """
    Fetches a list of posts with optional limit
    """
    posts(limit: Int): [Post!]!
  }

  type Mutation {
    """
    Creates a new user account
    """
    createUser(input: CreateUserInput!): User
  }

  input CreateUserInput {
    username: String!
    email: String!
  }
`;

// Convert to MCP tools (queries only by default)
const tools = await schemaParser(schema);

// Or with custom configuration to include mutations and subscriptions
const toolsWithMutations = await schemaParser(schema, {
  query: true,
  mutation: true,
  subscription: false,
  queryPrefix: 'get_',
  mutationPrefix: 'do_'
});

// Use the generated tools
const userTool = tools.find(tool => tool.name === 'user');

// Access the preserved description from GraphQL schema
console.log(userTool.description);
// Output: "Retrieves a user by their unique identifier"

// The tool automatically validates inputs and field selections
const result = await userTool.execution(
  { id: "123" }, // Variables - validated against input schema
  { id: true, username: true, posts: { title: true } } // Field selection - validated against output schema
);

console.log(result.query);
// Output: query user($id: ID!) { user(id: $id) { id username posts { title } } }

// Access the validation schemas directly
console.log('Input schema:', userTool.inputSchema);
console.log('Output schema:', userTool.outputSchema);
console.log('Description:', userTool.description); // GraphQL field description
```

## Integration Example

Here's a simplified example of how to integrate the generated tools with an MCP server:

```typescript
import { schemaParser } from 'graphql-mcp-bridge';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

export async function registerSchemaTools(
  parsedSchema: Tool[],
  mcpServer: McpServer,
) {
  for (const tool of parsedSchema) {
    mcpServer.registerTool(
      tool.name,
      {
        description: tool.description || "No description provided",
        inputSchema: {
          input: tool.inputSchema,
          output: tool.outputSchema,
        },
      },
      async ({ input, output }) => {
        const res = await tool.execution(input, output);
        const { data, error } = await queryRunner(res.query, res.variables);

        if (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error from GraphQL API: ${JSON.stringify(error, null, 2)}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      },
    );
  }

  console.info(
    "Registered Tools:",
    parsedSchema.map((s) => s.name),
  );
}

// Usage
const schema = `/* your GraphQL schema */`;
const tools = await schemaParser(schema);
await registerSchemaTools(tools, mcpServer);
```

## Description Preservation

GraphQL MCP Bridge automatically preserves GraphQL field descriptions and exposes them as tool descriptions. This feature ensures that documentation from your GraphQL schema is carried over to the generated MCP tools.

### How It Works

```typescript
const schema = `
  type Query {
    """
    Retrieves user information by ID
    Supports fetching related posts and profile data
    """
    getUser(id: ID!): User

    """
    Lists all users with pagination support
    """
    getUsers(limit: Int, offset: Int): [User!]!

    # This field has no description
    healthCheck: String
  }

  type User {
    id: ID!
    username: String!
  }
`;

const tools = await schemaParser(schema);

// Description is preserved from GraphQL schema
const getUserTool = tools.find(tool => tool.name === 'getUser');
console.log(getUserTool.description);
// Output: "Retrieves user information by ID\nSupports fetching related posts and profile data"

const getUsersTool = tools.find(tool => tool.name === 'getUsers');
console.log(getUsersTool.description);
// Output: "Lists all users with pagination support"

// Fallback description for fields without documentation
const healthCheckTool = tools.find(tool => tool.name === 'healthCheck');
console.log(healthCheckTool.description);
// Output: "GraphQL query operation: healthCheck"
```

### Description Fallbacks

When a GraphQL field doesn't have a description, the system provides a meaningful fallback:

- **Queries**: `"GraphQL query operation: {fieldName}"`
- **Mutations**: `"GraphQL mutation operation: {fieldName}"`
- **Subscriptions**: `"GraphQL subscription operation: {fieldName}"`

### Integration with MCP Servers

The preserved descriptions integrate seamlessly with MCP servers:

```typescript
mcpServer.registerTool(
  tool.name,
  {
    description: tool.description, // Uses GraphQL field description or fallback
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
  },
  async ({ input, output }) => {
    // Tool execution logic
  }
);
```

This ensures that AI systems and other consumers of your MCP tools have access to the original documentation from your GraphQL schema.

## Selective Tool Generation

GraphQL MCP Bridge provides flexible ways to control which operations are converted to MCP tools, allowing you to exclude specific operations from tool generation.

### Using Ignore Phrases

You can prevent specific GraphQL operations from being converted to MCP tools by including a special phrase in their description. By default, any operation containing `NO_MPC_TOOL` in its description will be skipped.

```typescript
const schema = `
  type Query {
    getUser(id: ID!): User

    # This operation will be ignored and no tool will be generated
    internalHealthCheck: String @deprecated(reason: "NO_MPC_TOOL - Internal use only")

    # This will also be ignored
    """
    Administrative function for internal monitoring
    NO_MPC_TOOL
    """
    adminDashboard: AdminStats

    # This operation will be included as it doesn't contain the ignore phrase
    getUsers: [User!]!
  }
`;

const tools = await schemaParser(schema);
// Only generates tools for: getUser, getUsers
// Skips: internalHealthCheck, adminDashboard
```

### Custom Ignore Phrases

You can customize the ignore phrase to match your naming conventions:

```typescript
const tools = await schemaParser(schema, {
  ignorePhrase: 'INTERNAL_ONLY'
});

// Now any operation with 'INTERNAL_ONLY' in its description will be skipped
const schemaWithCustomIgnore = `
  type Query {
    getUser(id: ID!): User

    # This will be ignored
    debugQuery: String # INTERNAL_ONLY - Debug purposes
  }
`;
```

### Alternative Approach: Schema Preprocessing

Instead of using ignore phrases, you can preprocess your GraphQL schema to remove unwanted operations before passing it to the library:

```typescript
// Remove specific operations from schema string
function removeInternalOperations(schemaString: string): string {
  // Custom logic to filter out operations
  // This approach gives you complete control over schema modification
  return filteredSchema;
}

const cleanedSchema = removeInternalOperations(originalSchema);
const tools = await schemaParser(cleanedSchema);
```

### Best Practices

1. **Use Descriptive Ignore Phrases**: Choose phrases that clearly indicate why an operation should be ignored
2. **Document Your Convention**: If using custom ignore phrases, document them in your team's GraphQL schema guidelines
3. **Consider Schema Preprocessing**: For complex filtering logic, schema preprocessing might be more maintainable than ignore phrases

## Advanced Configuration Examples

### Selective Operation Types

```typescript
```

## Configuration

GraphQL MCP Bridge supports configurable operation generation through the `Config` type. This allows you to control which types of operations are included and customize their naming.

### Configuration Options

```typescript
export type Config = {
  /**
   * Include mutation operations
   * Default: false
   */
  mutation?: boolean;

  /**
   * Include subscription operations
   * Default: false
   * Note: Subscriptions are not yet fully supported. You can generate
   * the functions, but need to handle subscription logic yourself.
   */
  subscription?: boolean;

  /**
   * Include query operations
   * Default: true
   */
  query?: boolean;

  /**
   * Prefix for query operation names
   * Example: 'get_' would turn 'user' into 'get_user'
   * Default: ''
   */
  queryPrefix?: string;

  /**
   * Prefix for mutation operation names
   * Example: 'do_' would turn 'createUser' into 'do_createUser'
   * Default: ''
   */
  mutationPrefix?: string;

  /**
   * Prefix for subscription operation names
   * Example: 'sub_' would turn 'userUpdated' into 'sub_userUpdated'
   * Default: ''
   */
  subscriptionPrefix?: string;

  /**
   * If a query or mutation has this phrase in its description, it will be ignored and no tool will be generated for it.
   * Default: 'NO_MPC_TOOL'
   */
  ignorePhrase?: string;

  /**
   * Maximum number of operations to process to prevent memory exhaustion.
   * Useful for very large GraphQL schemas like GitHub's.
   * Default: 200
   */
  maxOperations?: number;

  /**
   * Maximum number of arguments per operation to process.
   * Limits processing of operations with excessive arguments.
   * Default: 50
   */
  maxOperationArgs?: number;

  /**
   * Maximum schema processing depth to prevent stack overflow.
   * Controls how deeply nested types are processed.
   * Default: 10
   */
  maxSchemaDepth?: number;

  /**
   * Maximum number of fields per type to process.
   * Limits processing of types with excessive fields.
   * Default: 100
   */
  maxFields?: number;
};
```

### Configuration Examples

```typescript
// Default configuration - queries only
const tools = await schemaParser(schema);

// Include mutations with custom prefixes
const toolsWithMutations = await schemaParser(schema, {
  query: true,
  mutation: true,
  queryPrefix: 'fetch_',
  mutationPrefix: 'execute_'
});

// All operation types with subscription prefix
const allTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  subscription: true,
  subscriptionPrefix: 'listen_'
});

// Only mutations
const mutationTools = await schemaParser(schema, {
  query: false,
  mutation: true
});

// Custom ignore phrase for selective tool generation
const selectiveTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  ignorePhrase: 'INTERNAL_ONLY'
});

// Memory optimization for large schemas
const optimizedTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  maxOperations: 100,        // Process only first 100 operations
  maxOperationArgs: 25,      // Limit to 25 arguments per operation
  maxSchemaDepth: 5,         // Limit nested type depth
  maxFields: 50              // Limit fields per type
});

// Configuration for very large schemas (like GitHub GraphQL API)
const githubOptimized = await schemaParser(githubSchema, {
  query: true,
  mutation: false,           // Skip mutations for faster processing
  maxOperations: 50,         // Very conservative limit
  maxSchemaDepth: 3,         // Shallow processing
  maxFields: 20,             // Conservative field limit
  ignorePhrase: 'DEPRECATED' // Skip deprecated operations
});
```

## Practical Configuration Examples

### Operation Type Selection

```typescript
const schema = `
  type Query {
    getUser(id: ID!): User
    getUsers: [User!]!
  }

  type Mutation {
    createUser(input: CreateUserInput!): User
    updateUser(id: ID!, input: UpdateUserInput!): User
  }

  type Subscription {
    userUpdated: User
  }

  type User {
    id: ID!
    username: String!
  }

  input CreateUserInput {
    username: String!
  }

  input UpdateUserInput {
    username: String
  }
`;

// Only queries (default behavior)
const queryTools = await schemaParser(schema);
console.log(queryTools.map(t => t.name));
// Output: ['getUser', 'getUsers']

// Include mutations with prefix
const mutationTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  mutationPrefix: 'execute_'
});
console.log(mutationTools.map(t => t.name));
// Output: ['getUser', 'getUsers', 'execute_createUser', 'execute_updateUser']

// All operations with custom prefixes
const allTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  subscription: true,
  queryPrefix: 'fetch_',
  mutationPrefix: 'do_',
  subscriptionPrefix: 'listen_'
});
console.log(allTools.map(t => t.name));
// Output: ['fetch_getUser', 'fetch_getUsers', 'do_createUser', 'do_updateUser', 'listen_userUpdated']
```

### Custom Naming Patterns

```typescript
// API-style naming
const apiTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  queryPrefix: 'api_get_',
  mutationPrefix: 'api_post_'
});

// GraphQL operation type prefixes
const typedTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  subscription: true,
  queryPrefix: 'QUERY_',
  mutationPrefix: 'MUTATION_',
  subscriptionPrefix: 'SUBSCRIPTION_'
});
```

## Validation System

GraphQL MCP Bridge includes a comprehensive validation system powered by Zod that ensures type safety at runtime. The validation system works on two levels:

### Input Validation

All operation arguments are automatically validated against Zod schemas generated from the GraphQL schema:

```typescript
// The tool automatically validates input arguments
const result = await createUserTool.execution(
  { input: { username: "john", email: "john@example.com" } }, // ✅ Valid
  { id: true, username: true }
);

// This will throw a validation error
try {
  await createUserTool.execution(
    { input: { username: "john" } }, // ❌ Missing required 'email' field
    { id: true }
  );
} catch (error) {
  console.error(error.message); // "Validation failed for createUser: ..."
}
```

### Output Selection Validation

Field selection objects are validated to ensure you only select existing fields:

```typescript
// Valid field selection
const result = await getUserTool.execution(
  { id: "123" },
  {
    id: true,
    username: true,
    posts: { id: true, title: true } // ✅ Valid nested selection
  }
);

// This will throw a validation error
try {
  await getUserTool.execution(
    { id: "123" },
    { id: true, nonExistentField: true } // ❌ Field doesn't exist
  );
} catch (error) {
  console.error(error.message); // Output selection validation failed
}
```

### Manual Validation

You can also use the validation functions directly:

```typescript
import {
  validateOperationArguments,
  validateOutputSelection,
  generateValidationSchemas,
  generateOutputSelectionSchemas
} from 'graphql-mcp-bridge';

const tools = await schemaParser(schema);
const userTool = tools.find(tool => tool.name === 'user');

// Validate arguments manually
try {
  const validatedArgs = userTool.inputSchema.parse({ id: "123" });
  console.log('Arguments are valid:', validatedArgs);
} catch (error) {
  console.error('Invalid arguments:', error.message);
}

// Validate output selection manually
try {
  const validatedSelection = userTool.outputSchema.parse({
    id: true,
    username: true
  });
  console.log('Selection is valid:', validatedSelection);
} catch (error) {
  console.error('Invalid selection:', error.message);
}
```

### Default Field Selection

When no field selection is provided or an empty object is passed, the system automatically selects all scalar and enum fields at the first level:

```typescript
// These are equivalent:
await getUserTool.execution({ id: "123" }, {});
await getUserTool.execution({ id: "123" }, {
  id: true,
  username: true,
  email: true,
  createdAt: true
  // Complex fields like 'posts' are not auto-selected
});
```

### Supported Validation Features

- ✅ **Scalar Types**: String, Int, Float, Boolean, ID with proper type checking
- ✅ **Enum Validation**: Ensures only valid enum values are accepted
- ✅ **Complex Input Objects**: Nested input validation with proper type checking
- ✅ **List Types**: Array validation with item type checking
- ✅ **Non-null Types**: Required field validation
- ✅ **Optional Fields**: Proper handling of nullable fields
- ✅ **Circular References**: Safe handling without infinite recursion
- ✅ **Union Types**: Validation for fragment selections
- ✅ **Interface Types**: Validation for interface implementations

## Memory Optimization for Large Schemas

When working with very large GraphQL schemas (like GitHub's 70K+ line schema), memory optimization becomes crucial. The library provides several configuration options to prevent JavaScript heap out of memory errors:

### Memory Optimization Options

- **`maxOperations`**: Limits the number of operations processed (default: 200)
- **`maxOperationArgs`**: Limits arguments per operation (default: 50)
- **`maxSchemaDepth`**: Prevents deep recursion in nested types (default: 10)
- **`maxFields`**: Limits fields processed per type (default: 100)

### Example: GitHub GraphQL API

```typescript
import { schemaParser } from 'graphql-mcp-bridge';

// Optimized configuration for GitHub's large schema
const tools = await schemaParser(githubSchema, {
  query: true,
  mutation: false,           // Skip mutations for faster processing
  maxOperations: 100,        // Process only essential operations
  maxSchemaDepth: 5,         // Limit depth to prevent stack overflow
  maxFields: 30,             // Conservative field limit
  maxOperationArgs: 20,      // Limit complex operation arguments
  ignorePhrase: 'DEPRECATED' // Skip deprecated operations
});

console.log(`Generated ${tools.length} tools from large schema`);
```

### Memory-Efficient Batch Processing

For extremely large schemas, use the memory-efficient batch parser:

```typescript
import { parseSchemaInBatches } from 'graphql-mcp-bridge';

// Process in small batches with memory cleanup
const tools = await parseSchemaInBatches(massiveSchema, {
  query: true,
  batchSize: 25,              // Process 25 operations at a time
  clearCacheInterval: 50,     // Clear cache every 50 operations
  maxOperations: 200,         // Total operations limit
  maxSchemaDepth: 3           // Very shallow processing
});
```

### Memory Management Utilities

```typescript
import { clearTypeSchemaCache, getTypeSchemaCacheSize } from 'graphql-mcp-bridge';

// Monitor cache size
console.log(`Cache contains ${getTypeSchemaCacheSize()} schemas`);

// Clear cache to free memory
clearTypeSchemaCache();
```

### Performance Tips

1. **Start Conservative**: Begin with low limits and increase as needed
2. **Skip Complex Operations**: Use `ignorePhrase` to skip complex or deprecated operations
3. **Limit Operation Types**: Process only queries for read-only use cases
4. **Monitor Memory**: Use Node.js `--max-old-space-size` flag if needed
5. **Batch Processing**: Use `parseSchemaInBatches` for schemas over 10K lines

## Advanced Usage Examples

### Basic Query with Field Selection

```typescript
// Simple query without arguments
const schema = `
  type Query {
    hello: String
  }
`;

const tools = await schemaParser(schema);
const helloTool = tools[0];
const result = await helloTool.execution({}, {});
// Output: query hello { hello }
```

### Mutations with Input Validation

```typescript
const schema = `
  type Mutation {
    createUser(input: CreateUserInput!): User
  }

  input CreateUserInput {
    username: String!
    email: String!
  }

  type User {
    id: ID!
    username: String!
    email: String!
  }
`;

// Enable mutations in configuration
const tools = await schemaParser(schema, {
  query: true,
  mutation: true
});
const createUserTool = tools.find(tool => tool.name === 'createUser');

// Valid input
const result = await createUserTool.execution(
  { input: { username: "john_doe", email: "john@example.com" } },
  { id: true, username: true }
);
// Output: mutation createUser($input: CreateUserInput!) { createUser(input: $input) { id username } }

// Invalid input throws validation error
try {
  await createUserTool.execution(
    { input: { username: "john_doe" } }, // Missing email
    { id: true }
  );
} catch (error) {
  console.error(error.message); // Validation error for missing email
}
```

### Working with Enums

```typescript
const schema = `
  enum Role {
    ADMIN
    USER
    GUEST
  }

  type User {
    id: ID!
    username: String!
    role: Role!
  }

  type Query {
    getUsersByRole(role: Role!): [User!]
  }
`;

const tools = await schemaParser(schema);
const getUsersByRoleTool = tools[0];

const result = await getUsersByRoleTool.execution(
  { role: "ADMIN" },
  { id: true, username: true, role: true }
);
// Output: query getUsersByRole($role: Role!) { getUsersByRole(role: $role) { id username role } }
```

### Complex Nested Selections

```typescript
const schema = `
  type Comment {
    id: ID!
    content: String!
  }

  type Post {
    id: ID!
    title: String!
    comments: [Comment!]!
  }

  type User {
    id: ID!
    username: String!
    posts: [Post!]!
  }

  type Query {
    getUser(id: ID!): User
  }
`;

const tools = await schemaParser(schema);
const getUserTool = tools[0];

const result = await getUserTool.execution(
  { id: "123" },
  {
    id: true,
    username: true,
    posts: {
      title: true,
      comments: {
        content: true
      }
    }
  }
);
// Output: query getUser($id: ID!) { getUser(id: $id) { id username posts { title comments { content } } } }
```

### Union and Interface Types

```typescript
const schema = `
  interface Animal {
    id: ID!
    name: String!
  }

  type Dog implements Animal {
    id: ID!
    name: String!
    breed: String!
  }

  type Cat implements Animal {
    id: ID!
    name: String!
    color: String!
  }

  union Pet = Dog | Cat

  type Query {
    getPet(id: ID!): Pet
    getAnimal(id: ID!): Animal
  }
`;

const tools = await schemaParser(schema);

// Union type selection
const getPetTool = tools.find(tool => tool.name === 'getPet');
const petResult = await getPetTool.execution(
  { id: "123" },
  {
    __typename: true,
    Dog: { id: true, name: true, breed: true },
    Cat: { id: true, name: true, color: true }
  }
);
// Output: query getPet($id: ID!) { getPet(id: $id) { __typename ... on Dog { id name breed } ... on Cat { id name color } } }

// Interface type selection
const getAnimalTool = tools.find(tool => tool.name === 'getAnimal');
const animalResult = await getAnimalTool.execution(
  { id: "456" },
  {
    id: true,
    name: true,
    Dog: { breed: true },
    Cat: { color: true }
  }
);
// Output: query getAnimal($id: ID!) { getAnimal(id: $id) { id name ... on Dog { breed } ... on Cat { color } } }
```

### Complex Input Types with Validation

```typescript
const schema = `
  enum Status {
    ACTIVE
    INACTIVE
    PENDING
  }

  input RangeInput {
    start: Int!
    end: Int!
  }

  input FilterInput {
    status: Status
    tags: [String!]
    range: RangeInput
  }

  type Item {
    id: ID!
    name: String!
    status: Status!
    tags: [String!]!
    details: Details
  }

  type Details {
    description: String
    createdAt: String!
    updatedAt: String
  }

  type Query {
    getItems(filter: FilterInput): [Item!]!
  }
`;

const tools = await schemaParser(schema);
const getItemsTool = tools[0];

// Valid complex input
const result = await getItemsTool.execution(
  {
    filter: {
      status: "ACTIVE",
      tags: ["tag1", "tag2"],
      range: { start: 10, end: 50 }
    }
  },
  {
    id: true,
    name: true,
    status: true,
    details: {
      description: true,
      createdAt: true
    }
  }
);

// Access validation schemas directly
const inputSchema = getItemsTool.inputSchema;
const outputSchema = getItemsTool.outputSchema;

// Validate input manually
try {
  inputSchema.parse({ filter: { status: "INVALID_STATUS" } });
} catch (error) {
  console.error("Invalid input:", error.message);
}

// Validate output selection manually
try {
  outputSchema.parse({ id: true, nonExistentField: true });
} catch (error) {
  console.error("Invalid field selection:", error.message);
}
```

## API Reference

### Core Functions

#### `schemaParser(graphqlSchema: string, config?: Config): Promise<Tool[]>`

Parses a GraphQL schema string and returns an array of MCP-compatible tools with built-in validation and field selection.

**Parameters:**

- `graphqlSchema` (string): A valid GraphQL schema definition
- `config` (Config, optional): Configuration object to control operation generation

**Returns:**

- `Promise<Tool[]>`: Array of MCP tools, each containing:
  - `name`: Operation name (with optional prefix applied)
  - `execution(variables, selectedFields)`: Async function that returns `{ query, variables }`
  - `description`: GraphQL field description or auto-generated fallback description
  - `inputSchema`: Zod schema for input validation
  - `outputSchema`: Zod schema for output field selection validation

**Config Type:**

```typescript
type Config = {
  mutation?: boolean;      // Include mutations (default: false)
  subscription?: boolean;  // Include subscriptions (default: false)
  query?: boolean;         // Include queries (default: true)
  queryPrefix?: string;    // Prefix for query names (default: '')
  mutationPrefix?: string; // Prefix for mutation names (default: '')
  subscriptionPrefix?: string; // Prefix for subscription names (default: '')
  ignorePhrase?: string;   // Ignore operations with this phrase in description (default: 'NO_MPC_TOOL')
};
```

#### `generateQueryString(operation, variables?, selectedFields?): string`

Generates a GraphQL query string from an operation definition with optional variables and field selection.

### Validation Functions

#### `generateValidationSchemas(operations, schema): Record<string, z.ZodSchema>`

Generates Zod validation schemas for GraphQL operations input arguments.

**Parameters:**

- `operations`: Array of GraphQL operations extracted from schema
- `schema`: GraphQL schema object

**Returns:**

- Object mapping operation names to their input validation schemas

#### `generateOutputSelectionSchemas(operations, schema): Record<string, z.ZodSchema>`

Generates Zod schemas for validating output field selections, supporting nested objects, unions, and interfaces.

**Parameters:**

- `operations`: Array of GraphQL operations extracted from schema
- `schema`: GraphQL schema object

**Returns:**

- Object mapping operation names to their output selection validation schemas

#### `validateOperationArguments(operationName, variables, validationSchemas): any`

Validates operation arguments against generated Zod schemas.

**Parameters:**

- `operationName` (string): Name of the GraphQL operation
- `variables` (any): Input variables to validate
- `validationSchemas` (Record<string, z.ZodSchema>): Generated validation schemas

**Returns:**

- Validated and parsed variables object

**Throws:**

- Error if validation fails with detailed error message

#### `validateOutputSelection(operationName, selection, outputSchemas): any`

Validates output field selection against generated output schemas.

**Parameters:**

- `operationName` (string): Name of the GraphQL operation
- `selection` (any): Field selection object to validate
- `outputSchemas` (Record<string, z.ZodSchema>): Generated output selection schemas

**Returns:**

- Validated and parsed selection object (with defaults applied if empty)

**Throws:**

- Error if validation fails with detailed error message

### Tool Structure

Each generated tool from `schemaParser` has the following structure:

```typescript
type Tool = {
  name: string;
  execution: (variables: any, selectedFields: any) => Promise<{
    query: string;
    variables: any;
  }>;
  description: string; // GraphQL field description or auto-generated fallback
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
};
```

### Field Selection Syntax

The field selection parameter supports:

- **Simple fields**: `{ id: true, name: true }`
- **Nested objects**: `{ user: { id: true, posts: { title: true } } }`
- **Union types**: `{ __typename: true, Dog: { breed: true }, Cat: { color: true } }`
- **Interface types**: `{ id: true, Dog: { breed: true }, Cat: { color: true } }`
- **Arrays**: Automatically handled for list types

## Error Handling

The library provides detailed error messages for validation issues, with comprehensive coverage of GraphQL type validation:

### Input Validation Errors

```typescript
// Missing required field
throw new Error('Validation failed for createUser: Required at "input.email"');

// Wrong type
throw new Error('Validation failed for updateUser: Expected string, received number at "input.username"');

// Invalid enum value
throw new Error('Validation failed for updatePost: Invalid enum value. Expected DRAFT | PUBLISHED, received INVALID at "input.status"');

// Array validation
throw new Error('Validation failed for createPost: Expected array, received string at "input.tags"');

// Nested object validation
throw new Error('Validation failed for createUser: Required at "input.profile.firstName"');
```

### Output Selection Validation Errors

```typescript
// Non-existent field
throw new Error('Output selection validation failed for getUser: Unrecognized key(s) in object: "nonExistentField"');

// Wrong selection type
throw new Error('Output selection validation failed for getUser: Expected boolean, received string at "id"');

// Invalid nested selection
throw new Error('Output selection validation failed for getUser: Unrecognized key(s) in object: "invalidNestedField" at "posts"');
```

### Circular Reference Handling

The validation system safely handles circular references in GraphQL schemas:

```typescript
// For schemas with circular references like User -> Post -> User
// The system provides fallback schemas to prevent infinite recursion
const tools = await schemaParser(schemaWithCircularRefs); // ✅ Works safely
```

### Validation Error Structure

All validation errors follow a consistent structure:

```typescript
try {
  await tool.execution(invalidInput, invalidSelection);
} catch (error) {
  console.log(error.message); // User-friendly error message
  console.log(error.name);    // 'Error'
  // Original Zod error details are parsed into readable format
}
```

## Supported GraphQL Features

### Core Operations

- ✅ **Queries and Mutations**: Full support for Query and Mutation operations with validation
- ✅ **Subscriptions**: Configurable subscription support (function generation only - WebSocket handling required)
- ✅ **Operation Selection**: Choose which operation types to include via configuration
- ✅ **Custom Naming**: Configurable prefixes for operation names
- ✅ **Description Preservation**: Automatically preserves GraphQL field descriptions as tool descriptions

### Type System

- ✅ **Scalar Types**: String, Int, Float, Boolean, ID with proper Zod validation
- ✅ **Object Types**: Complex nested object structures with recursive validation
- ✅ **Input Types**: Complex input arguments with comprehensive validation
- ✅ **Enums**: Enumeration types with strict value validation
- ✅ **Lists**: Arrays of any supported type with item validation
- ✅ **Non-null Types**: Required field validation with proper error messages
- ✅ **Interfaces**: Interface types with fragment selection validation
- ✅ **Union Types**: Union types with fragment selection validation
- ⚠️ **Custom Scalars**: Limited support (treated as strings with basic validation)

### Advanced Features

- ✅ **Configurable Operation Generation**: Selective inclusion of queries, mutations, and subscriptions
- ✅ **Custom Operation Naming**: Configurable prefixes for operation names
- ✅ **Nested Field Selection**: Deep object field selection with validation
- ✅ **Circular References**: Safe handling without infinite recursion
- ✅ **Default Selections**: Automatic selection of scalar/enum fields when no selection provided
- ✅ **Fragment Validation**: Proper validation for union and interface fragment selections
- ✅ **Input Object Nesting**: Deep nested input validation with type checking
- ✅ **Optional Field Handling**: Proper nullable field validation

### Validation Features

- ✅ **Runtime Type Checking**: All inputs validated at runtime before execution
- ✅ **Schema-based Validation**: Generated from actual GraphQL schema definition
- ✅ **Detailed Error Messages**: User-friendly error reporting with field paths
- ✅ **Fallback Handling**: Graceful degradation for edge cases
- ✅ **Circular Reference Protection**: Prevents infinite loops in recursive types

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Run tests in watch mode
pnpm test:watch

# Build the package
pnpm run build

# Type checking
pnpm run type-check

# Format code
pnpm run format

# Check formatting
pnpm run format:check
```

## Testing

The project includes comprehensive test coverage for all features:

- Basic query and mutation generation
- Complex input type validation
- Enum type handling
- Interface and union type support
- Nested field selection
- Error handling and validation
- Edge cases and error conditions

Run tests with:

```bash
pnpm test
```

## Publishing

This package is published to npm. To publish a new version:

1. Update the version in `package.json`
2. Run `npm run build` to build the package
3. Run `npm publish` to publish to npm
4. Create a new release on GitHub for documentation

## Requirements

- **Node.js**: >= 24.0.0
- **Dependencies**: graphql, zod

## Troubleshooting

### Common Issues

If you encounter any installation issues, try:

1. **Clear npm cache**:

   ```bash
   npm cache clean --force
   # or
   pnpm store prune
   ```

2. **Update npm/pnpm**:

   ```bash
   npm install -g npm@latest
   # or
   npm install -g pnpm@latest
   ```

3. **Check Node.js version**: This package requires Node.js >= 24.0.0

If you're still having issues, please [open an issue](https://github.com/pshaddel/graphql-mcp-bridge/issues) on GitHub.

## License

ISC License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

1. Follow the existing code style (Biome formatting)
2. Add tests for any new features
3. Update documentation as needed
4. Ensure all tests pass before submitting

## Changelog

See [GitHub Releases](https://github.com/pshaddel/graphql-mcp-bridge/releases) for version history and changes.
