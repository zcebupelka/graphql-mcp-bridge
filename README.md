# GraphQL MCP Bridge
[![CI](https://github.com/pshaddel/graphql-mcp-bridge/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pshaddel/graphql-mcp-bridge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/github/pshaddel/graphql-mcp-bridge/graph/badge.svg?token=5DNFYP8N97)](https://codecov.io/github/pshaddel/graphql-mcp-bridge)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

A powerful bridge implementation connecting GraphQL APIs with the Model Context Protocol (MCP), enabling seamless integration between GraphQL services and MCP-compatible AI systems. Transform any GraphQL schema into type-safe, validated MCP tools with intelligent field selection and comprehensive runtime validation powered by Zod.

<div align="center">
<img width="80%" alt="Screenshot 2025-09-14 at 01 04 08" src="https://github.com/user-attachments/assets/33b5f7d5-e93e-4ed3-b3e8-472f2441b95b#gh-dark-mode-only" />
<img width="80%" alt="Screenshot 2025-09-14 at 01 02 40" src="https://github.com/user-attachments/assets/836dc4a4-cedd-4b3c-abcd-8eb4d35dadd4#gh-light-mode-only" />
</div>


## Features

- 🔗 **GraphQL to MCP Bridge**: Convert GraphQL schemas to MCP-compatible function definitions
- ⚙️ **Flexible Configuration**: Selective operation generation with customizable naming patterns
  - **Operation Type Control**: Choose which operation types to include (queries, mutations, subscriptions)
  - **Custom Prefixes**: Add prefixes to operation names for better organization
  - **Granular Control**: Fine-tune which operations are exposed as MCP tools
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
    user(id: ID!): User
    posts(limit: Int): [Post!]!
  }

  type Mutation {
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
```

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
  - `description`: Generated description of the operation
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
  description?: string;
  inputSchema?: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
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
