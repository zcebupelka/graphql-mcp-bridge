# GraphQL MCP Bridge

A powerful bridge implementation connecting GraphQL APIs with the Model Context Protocol (MCP), enabling seamless integration between GraphQL services and MCP-compatible AI systems. Transform any GraphQL schema into type-safe, validated MCP tools with intelligent field selection.

## Features

- 🔗 **GraphQL to MCP Bridge**: Convert GraphQL schemas to MCP-compatible function definitions
- 🛡️ **Type-Safe Validation**: Built-in Zod validation for GraphQL operations and arguments
- 🎯 **Smart Field Selection**: Dynamic field selection with support for nested objects, unions, and interfaces
- 🚀 **Query Generation**: Automatic GraphQL query string generation with variable handling
- 📝 **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- �️ **Advanced Schema Support**: Handles enums, interfaces, unions, complex inputs, and nested types
- ⚡ **Runtime Validation**: Input validation and output schema generation for robust API interactions

## Installation

### From GitHub Packages

```bash
# Add GitHub Packages registry to your .npmrc
echo "@pshaddel:registry=https://npm.pkg.github.com" >> .npmrc

# Install the package
npm install @pshaddel/graphql-mcp-bridge
```

## Quick Start

```typescript
import { schemaParser } from '@pshaddel/graphql-mcp-bridge';

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

// Convert to MCP tools
const tools = await schemaParser(schema);

// Use the generated tools
const userTool = tools.find(tool => tool.name === 'user');
const result = await userTool.execution(
  { id: "123" }, // Variables
  { id: true, username: true, posts: { title: true } } // Field selection
);

console.log(result.query);
// Output: query user($id: ID!) { user(id: $id) { id username posts { title } } }
```

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

const tools = await schemaParser(schema);
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

#### `schemaParser(graphqlSchema: string): Promise<Tool[]>`

Parses a GraphQL schema string and returns an array of MCP-compatible tools with built-in validation and field selection.

**Parameters:**

- `graphqlSchema` (string): A valid GraphQL schema definition

**Returns:**

- `Promise<Tool[]>`: Array of MCP tools, each containing:
  - `name`: Operation name
  - `execution(variables, selectedFields)`: Async function that returns `{ query, variables }`
  - `description`: Generated description of the operation
  - `inputSchema`: Zod schema for input validation
  - `outputSchema`: Zod schema for output field selection validation

#### `generateQueryString(operation, variables?, selectedFields?): string`

Generates a GraphQL query string from an operation definition with optional variables and field selection.

#### `generateValidationSchemas(operations, schema)`

Generates Zod validation schemas for GraphQL operations input arguments.

#### `generateOutputSelectionSchemas(operations, schema)`

Generates Zod schemas for validating output field selections, supporting nested objects, unions, and interfaces.

#### `validateOperationArguments(args, operationName, validationSchemas): boolean`

Validates operation arguments against generated Zod schemas.

#### `validateOutputSelection(selection, operationName, outputSchemas): boolean`

Validates output field selection against generated output schemas.

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

The library provides detailed error messages for common validation issues:

```typescript
// Missing required variable
throw new Error('Missing required variable: fieldName');

// Invalid type
throw new Error('Invalid type for variable fieldName: expected number, received string');

// Invalid enum value
throw new Error('Invalid enum value for field: expected ACTIVE|INACTIVE, received UNKNOWN');

// Invalid field selection
throw new Error('Field nonExistentField does not exist on type User');
```

## Supported GraphQL Features

- ✅ **Queries and Mutations**: Full support for Query and Mutation operations
- ✅ **Scalar Types**: String, Int, Float, Boolean, ID
- ✅ **Object Types**: Complex nested object structures
- ✅ **Input Types**: Complex input arguments with validation
- ✅ **Enums**: Enumeration types with validation
- ✅ **Lists**: Arrays of any supported type
- ✅ **Non-null Types**: Required field validation
- ✅ **Interfaces**: Interface types with fragment selection
- ✅ **Union Types**: Union types with fragment selection
- ✅ **Nested Field Selection**: Deep object field selection
- ⚠️ **Subscriptions**: Not currently supported
- ⚠️ **Custom Scalars**: Limited support (treated as strings)

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

## Publishing to GitHub Packages

This package is published to GitHub Packages. To publish a new version:

1. Update the version in `package.json`
2. Create a new release on GitHub
3. The GitHub Action will automatically build and publish the package

## Requirements

- **Node.js**: >= 24.0.0
- **Dependencies**: graphql, zod

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
