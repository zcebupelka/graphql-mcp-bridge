---
layout: default
title: Getting Started
nav_order: 2
description: "Installation, quick start guide, and basic usage examples for GraphQL MCP Bridge"
---

# Getting Started
{: .no_toc }

This guide will help you quickly get started with GraphQL MCP Bridge, from installation to your first working implementation.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

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
    author: User!
  }

  type Query {
    """
    Retrieves a user by their unique identifier
    """
    user(id: ID!): User

    """
    Lists all users with pagination support
    """
    users(limit: Int = 10, offset: Int = 0): [User!]!
  }
`;

// Convert to MCP tools (queries only by default)
const tools = await schemaParser(schema);

// Or with custom configuration to include mutations and subscriptions
const toolsWithMutations = await schemaParser(schema, {
  query: true,
  mutation: true,
  subscription: true,
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

## Basic Usage Examples

### Simple Query Without Arguments

```typescript
const schema = `
  type Query {
    hello: String!
  }
`;

const tools = await schemaParser(schema);
const helloTool = tools[0];
const result = await helloTool.execution({}, {});
// Output: query hello { hello }
```

### Working with Arguments

```typescript
const schema = `
  type Query {
    getUser(id: ID!): User
  }

  type User {
    id: ID!
    username: String!
    email: String!
  }
`;

const tools = await schemaParser(schema);
const getUserTool = tools[0];

const result = await getUserTool.execution(
  { id: "123" }, // Required arguments
  { id: true, username: true, email: true } // Field selection
);
// Output: query getUser($id: ID!) { getUser(id: $id) { id username email } }
```

### Working with Mutations

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

const result = await createUserTool.execution(
  { input: { username: "john_doe", email: "john@example.com" } },
  { id: true, username: true }
);
// Output: mutation createUser($input: CreateUserInput!) { createUser(input: $input) { id username } }
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
        description: tool.description,
        inputSchema: tool.inputSchema._def,
        outputSchema: tool.outputSchema._def,
      },
      async (args, outputSelection) => {
        try {
          const result = await tool.execution(args, outputSelection);
          return {
            content: [
              {
                type: 'text',
                text: `Generated GraphQL query: ${result.query}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }
}

// Usage
const schema = `/* your GraphQL schema */`;
const tools = await schemaParser(schema);
await registerSchemaTools(tools, mcpServer);
```

## Default Field Selection

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

## Next Steps

- Learn about [Configuration Options](configuration.md) to customize tool generation
- Explore [Validation System](validation.md) for type safety and error handling
- Check out [Advanced Usage](advanced-usage.md) for complex scenarios
- See [Optimization Guide](optimization.md) for handling large schemas