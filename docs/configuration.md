---
layout: default
title: Configuration
nav_order: 3
description: "Comprehensive guide to configuring GraphQL MCP Bridge for different use cases"
---

# Configuration

GraphQL MCP Bridge supports configurable operation generation through the `Config` type. This allows you to control which types of operations are included and customize their naming.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

## Configuration Options

```typescript
export type Config = {
  /**
   * Whether to include queries in the generated tools
   * @default true
   */
  query?: boolean;

  /**
   * Whether to include mutations in the generated tools
   * @default false
   */
  mutation?: boolean;

  /**
   * Whether to include subscriptions in the generated tools
   * @default false
   */
  subscription?: boolean;

  /**
   * Prefix to add to query operation names
   * @default ""
   */
  queryPrefix?: string;

  /**
   * Prefix to add to mutation operation names
   * @default ""
   */
  mutationPrefix?: string;

  /**
   * Prefix to add to subscription operation names
   * @default ""
   */
  subscriptionPrefix?: string;

  /**
   * Phrase to look for in operation descriptions to skip tool generation
   * Operations containing this phrase in their description will be ignored
   * @default "NO_MCP_TOOL"
   */
  ignorePhrase?: string;

  /**
   * Maximum number of operations to process (useful for large schemas)
   * @default 200
   */
  maxOperations?: number;

  /**
   * Maximum number of arguments per operation to process
   * @default 50
   */
  maxOperationArgs?: number;

  /**
   * Maximum depth for schema traversal (prevents infinite recursion)
   * @default 10
   */
  maxSchemaDepth?: number;

  /**
   * Maximum number of fields to process per type
   * @default 100
   */
  maxFields?: number;
};
```

## Basic Configuration Examples

### Default Configuration - Queries Only

```typescript
// Default configuration - queries only
const tools = await schemaParser(schema);
```

### Including Mutations

```typescript
// Include mutations with custom prefixes
const toolsWithMutations = await schemaParser(schema, {
  query: true,
  mutation: true,
  mutationPrefix: 'execute_'
});
```

### All Operation Types

```typescript
// All operation types with custom prefixes
const allTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  subscription: true,
  queryPrefix: 'fetch_',
  mutationPrefix: 'do_',
  subscriptionPrefix: 'listen_'
});
```

### Only Mutations

```typescript
// Only mutations
const mutationTools = await schemaParser(schema, {
  query: false,
  mutation: true
});
```

## Selective Tool Generation

### Using Ignore Phrases

You can prevent specific GraphQL operations from being converted to MCP tools by including a special phrase in their description. By default, any operation containing `NO_MCP_TOOL` in its description will be skipped.

```typescript
const schema = `
  type Query {
    """
    Gets user information by ID
    """
    getUser(id: ID!): User

    """
    Lists all users
    """
    getUsers: [User!]!

    """
    Internal health check endpoint - NO_MCP_TOOL
    """
    internalHealthCheck: String

    """
    Admin dashboard data - NO_MCP_TOOL
    """
    adminDashboard: AdminData
  }
`;

const tools = await schemaParser(schema);
// Only generates tools for: getUser, getUsers
// Skips: internalHealthCheck, adminDashboard
```

### Custom Ignore Phrases

```typescript
const tools = await schemaParser(schema, {
  ignorePhrase: 'INTERNAL_ONLY'
});

// Now any operation with 'INTERNAL_ONLY' in its description will be skipped
const schemaWithCustomIgnore = `
  type Query {
    """
    Public API endpoint
    """
    getPublicData: String

    """
    Internal system check - INTERNAL_ONLY
    """
    systemCheck: String
  }
`;
```

### Custom Ignore Phrase Example

```typescript
// Custom ignore phrase for selective tool generation
const selectiveTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  ignorePhrase: 'INTERNAL_ONLY'
});
```

## Custom Naming Patterns

### API-Style Naming

```typescript
// API-style naming
const apiTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  queryPrefix: 'api_get_',
  mutationPrefix: 'api_post_'
});
```

### GraphQL Operation Type Prefixes

```typescript
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
    userUpdated(id: ID!): User
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

## Memory Optimization Configuration

When working with large schemas, you can use memory optimization options to prevent JavaScript heap out of memory errors:

```typescript
// Memory optimization for large schemas
const optimizedTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  maxOperations: 100,        // Limit total operations
  maxOperationArgs: 20,      // Limit arguments per operation
  maxSchemaDepth: 5,         // Limit recursion depth
  maxFields: 50              // Limit fields per type
});

// Configuration for very large schemas (like GitHub GraphQL API)
const githubOptimized = await schemaParser(githubSchema, {
  query: true,
  mutation: false,
  maxOperations: 50,
  maxOperationArgs: 10,
  maxSchemaDepth: 3,
  ignorePhrase: 'DEPRECATED' // Skip deprecated operations
});
```

## Alternative Approaches

### Schema Preprocessing

Instead of using ignore phrases, you can preprocess your GraphQL schema to remove unwanted operations before passing it to the library:

```typescript
// Remove specific operations from schema string
function removeInternalOperations(schemaString: string): string {
  // Custom logic to filter out operations
  // Implementation depends on your specific needs
  return filteredSchema;
}

const cleanedSchema = removeInternalOperations(originalSchema);
const tools = await schemaParser(cleanedSchema);
```

## Best Practices

1. **Use Descriptive Ignore Phrases**: Choose phrases that clearly indicate why an operation should be ignored
2. **Document Your Convention**: If using custom ignore phrases, document them in your team's GraphQL schema guidelines
3. **Consider Schema Preprocessing**: For complex filtering logic, schema preprocessing might be more maintainable than ignore phrases
4. **Start Conservative**: Begin with low limits for large schemas and increase as needed
5. **Monitor Memory Usage**: Use Node.js `--max-old-space-size` flag if needed for very large schemas
6. **Choose Appropriate Prefixes**: Use consistent naming conventions that fit your application's patterns

## Common Configuration Patterns

### Read-Only Integration

```typescript
// For read-only integrations, only enable queries
const readOnlyTools = await schemaParser(schema, {
  query: true,
  mutation: false,
  subscription: false,
  queryPrefix: 'get_'
});
```

### Full GraphQL Integration

```typescript
// For comprehensive GraphQL integration
const fullTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  subscription: true,
  queryPrefix: 'query_',
  mutationPrefix: 'mutate_',
  subscriptionPrefix: 'subscribe_'
});
```

### Microservice Pattern

```typescript
// For microservice architectures with service prefixes
const serviceTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  queryPrefix: 'userService_get_',
  mutationPrefix: 'userService_update_'
});
```