# GraphQL MCP Bridge

A bridge implementation connecting GraphQL APIs with the Model Context Protocol (MCP), enabling seamless integration between GraphQL services and MCP-compatible AI systems.

## Features

- 🔗 **GraphQL to MCP Bridge**: Convert GraphQL schemas to MCP-compatible function definitions
- 🛡️ **Type-Safe Validation**: Built-in Zod validation for GraphQL operations and arguments
- 🚀 **Query Generation**: Automatic GraphQL query string generation from operations
- 📝 **TypeScript Support**: Full TypeScript support with type definitions
- 🎯 **Schema Parsing**: Parse GraphQL schemas and extract operation definitions

## Installation

### From GitHub Packages

```bash
# Add GitHub Packages registry to your .npmrc
echo "@pshaddel:registry=https://npm.pkg.github.com" >> .npmrc

# Install the package
npm install @pshaddel/graphql-mcp-bridge
```

## Usage

```typescript
import { schemaParser, generateQueryString, generateValidationSchemas } from '@pshaddel/graphql-mcp-bridge';

// Parse a GraphQL schema
const schema = `
  type Query {
    user(id: ID!): User
    posts(limit: Int): [Post]
  }

  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
  }
`;

// Convert to MCP tools
const tools = await schemaParser(schema);

// Generate query strings
const queryString = generateQueryString({
  name: 'user',
  type: 'query',
  args: [{ name: 'id', type: 'ID!' }]
});

// Generate validation schemas
const validationSchemas = generateValidationSchemas(operations, graphqlSchema);
```

## API Reference

### `schemaParser(graphqlSchema: string): Promise<Tool[]>`

Parses a GraphQL schema string and returns an array of MCP-compatible tools.

### `generateQueryString(operation: Operation): string`

Generates a GraphQL query string from an operation definition.

### `generateValidationSchemas(operations: any[], schema: GraphQLSchema)`

Generates Zod validation schemas for GraphQL operations.

### `validateOperationArguments(args: any, operationName: string, validationSchemas: any): boolean`

Validates operation arguments against generated schemas.

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the package
pnpm run build

# Type checking
pnpm run type-check
```

## Publishing to GitHub Packages

This package is published to GitHub Packages. To publish a new version:

1. Update the version in `package.json`
2. Create a new release on GitHub
3. The GitHub Action will automatically build and publish the package

## License

ISC License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
