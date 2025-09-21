---
layout: default
title: Advanced Usage
nav_order: 5
description: "Advanced examples, integration patterns, and complex use cases for GraphQL MCP Bridge"
---

# Advanced Usage

This guide covers advanced usage patterns, complex scenarios, and integration examples for GraphQL MCP Bridge.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

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
    getUsers(limit: Int = 10, offset: Int = 0): [User!]!

    healthCheck: String
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
    description: tool.description, // Preserved from GraphQL schema
    inputSchema: tool.inputSchema._def,
    outputSchema: tool.outputSchema._def,
  },
  handler
);
```

This ensures that AI systems and other consumers of your MCP tools have access to the original documentation from your GraphQL schema.

## Complex Schema Examples

### Working with Enums

```typescript
const schema = `
  enum Role {
    ADMIN
    USER
    MODERATOR
  }

  type Query {
    getUsersByRole(role: Role!): [User!]!
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
    author: User!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
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
  interface Node {
    id: ID!
  }

  type User implements Node {
    id: ID!
    username: String!
    email: String!
  }

  type Post implements Node {
    id: ID!
    title: String!
    content: String!
  }

  union SearchResult = User | Post

  type Query {
    search(query: String!): [SearchResult!]!
    getNode(id: ID!): Node
  }
`;

const tools = await schemaParser(schema);

// Union type handling
const searchTool = tools.find(tool => tool.name === 'search');
const result = await searchTool.execution(
  { query: "example" },
  {
    "... on User": {
      id: true,
      username: true,
      email: true
    },
    "... on Post": {
      id: true,
      title: true,
      content: true
    }
  }
);

// Interface type handling
const getNodeTool = tools.find(tool => tool.name === 'getNode');
const nodeResult = await getNodeTool.execution(
  { id: "123" },
  {
    id: true,
    "... on User": {
      username: true,
      email: true
    },
    "... on Post": {
      title: true,
      content: true
    }
  }
);
```

### Working with Custom Scalars

```typescript
const schema = `
  scalar DateTime
  scalar JSON

  type Event {
    id: ID!
    name: String!
    scheduledAt: DateTime!
    metadata: JSON
  }

  type Query {
    getEvent(id: ID!): Event
    getEventsByDate(date: DateTime!): [Event!]!
  }
`;

const tools = await schemaParser(schema);
const getEventsByDateTool = tools.find(tool => tool.name === 'getEventsByDate');

// Custom scalars are treated as strings in validation
const result = await getEventsByDateTool.execution(
  { date: "2023-12-25T10:00:00Z" }, // ISO string for DateTime
  { id: true, name: true, scheduledAt: true, metadata: true }
);
```

## Advanced Integration Patterns

### MCP Server Integration with Error Handling

```typescript
import { schemaParser } from 'graphql-mcp-bridge';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

export async function registerSchemaTools(
  parsedSchema: Tool[],
  mcpServer: McpServer,
  graphqlClient: GraphQLClient
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
          // Generate the GraphQL query
          const { query, variables } = await tool.execution(args, outputSelection);

          // Execute against your GraphQL endpoint
          const response = await graphqlClient.query({
            query: gql`${query}`,
            variables
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
          };
        } catch (error) {
          if (error.name === 'ZodError') {
            // Handle validation errors
            return {
              content: [
                {
                  type: 'text',
                  text: `Validation Error: ${error.message}`,
                },
              ],
              isError: true,
            };
          }

          // Handle other errors
          return {
            content: [
              {
                type: 'text',
                text: `Error executing GraphQL operation: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }
}
```

### Middleware Pattern for Tool Execution

```typescript
type ToolMiddleware = (
  tool: Tool,
  args: any,
  outputSelection: any,
  next: () => Promise<any>
) => Promise<any>;

const loggingMiddleware: ToolMiddleware = async (tool, args, outputSelection, next) => {
  console.log(`Executing tool: ${tool.name}`, { args, outputSelection });
  const start = Date.now();

  try {
    const result = await next();
    console.log(`Tool ${tool.name} completed in ${Date.now() - start}ms`);
    return result;
  } catch (error) {
    console.error(`Tool ${tool.name} failed after ${Date.now() - start}ms:`, error);
    throw error;
  }
};

const authorizationMiddleware: ToolMiddleware = async (tool, args, outputSelection, next) => {
  // Check if the operation requires authorization
  if (tool.name.startsWith('admin_')) {
    // Implement your authorization logic
    if (!isAuthorized(args.userId)) {
      throw new Error('Unauthorized access to admin operation');
    }
  }

  return next();
};

// Compose middleware
function withMiddleware(tool: Tool, middlewares: ToolMiddleware[]) {
  const originalExecution = tool.execution.bind(tool);

  tool.execution = async (args: any, outputSelection: any) => {
    let index = 0;

    const next = async (): Promise<any> => {
      if (index >= middlewares.length) {
        return originalExecution(args, outputSelection);
      }

      const middleware = middlewares[index++];
      return middleware(tool, args, outputSelection, next);
    };

    return next();
  };

  return tool;
}

// Usage
const tools = await schemaParser(schema);
const enhancedTools = tools.map(tool =>
  withMiddleware(tool, [loggingMiddleware, authorizationMiddleware])
);
```

### Caching Layer Integration

```typescript
import { LRUCache } from 'lru-cache';

class CachedToolExecutor {
  private cache = new LRUCache<string, any>({
    max: 1000,
    ttl: 1000 * 60 * 5, // 5 minutes
  });

  private generateCacheKey(toolName: string, args: any, outputSelection: any): string {
    return `${toolName}:${JSON.stringify({ args, outputSelection })}`;
  }

  async executeWithCache(tool: Tool, args: any, outputSelection: any) {
    const cacheKey = this.generateCacheKey(tool.name, args, outputSelection);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${tool.name}`);
      return cached;
    }

    // Execute tool
    const result = await tool.execution(args, outputSelection);

    // Cache the result
    this.cache.set(cacheKey, result);
    console.log(`Cached result for ${tool.name}`);

    return result;
  }
}

// Usage
const cachedExecutor = new CachedToolExecutor();
const tools = await schemaParser(schema);

// Execute with caching
const result = await cachedExecutor.executeWithCache(
  tools[0],
  { id: "123" },
  { id: true, username: true }
);
```

### Schema Versioning and Migration

```typescript
interface SchemaVersion {
  version: string;
  schema: string;
  migrations?: {
    from: string;
    transform: (args: any) => any;
  }[];
}

class VersionedSchemaParser {
  private versions: Map<string, SchemaVersion> = new Map();
  private toolCache: Map<string, Tool[]> = new Map();

  async addVersion(versionInfo: SchemaVersion) {
    this.versions.set(versionInfo.version, versionInfo);

    // Parse and cache tools for this version
    const tools = await schemaParser(versionInfo.schema);
    this.toolCache.set(versionInfo.version, tools);
  }

  async getTools(version: string): Promise<Tool[]> {
    const cachedTools = this.toolCache.get(version);
    if (cachedTools) {
      return cachedTools;
    }

    const versionInfo = this.versions.get(version);
    if (!versionInfo) {
      throw new Error(`Schema version ${version} not found`);
    }

    const tools = await schemaParser(versionInfo.schema);
    this.toolCache.set(version, tools);
    return tools;
  }

  async executeWithMigration(
    version: string,
    targetVersion: string,
    toolName: string,
    args: any,
    outputSelection: any
  ) {
    const tools = await this.getTools(targetVersion);
    const tool = tools.find(t => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool ${toolName} not found in version ${targetVersion}`);
    }

    // Apply migrations if needed
    let migratedArgs = args;
    if (version !== targetVersion) {
      migratedArgs = this.applyMigrations(version, targetVersion, args);
    }

    return tool.execution(migratedArgs, outputSelection);
  }

  private applyMigrations(fromVersion: string, toVersion: string, args: any): any {
    // Implementation depends on your migration strategy
    // This is a simplified example
    const targetVersionInfo = this.versions.get(toVersion);
    if (!targetVersionInfo?.migrations) {
      return args;
    }

    const migration = targetVersionInfo.migrations.find(m => m.from === fromVersion);
    if (migration) {
      return migration.transform(args);
    }

    return args;
  }
}

// Usage
const versionedParser = new VersionedSchemaParser();

await versionedParser.addVersion({
  version: 'v1',
  schema: schemaV1
});

await versionedParser.addVersion({
  version: 'v2',
  schema: schemaV2,
  migrations: [{
    from: 'v1',
    transform: (args) => ({
      ...args,
      // Transform args from v1 to v2 format
      newField: args.oldField
    })
  }]
});

// Execute with automatic migration
const result = await versionedParser.executeWithMigration(
  'v1', // client version
  'v2', // server version
  'getUser',
  { id: "123" },
  { id: true, username: true }
);
```

## Performance Optimization Patterns

### Lazy Tool Loading

```typescript
class LazyToolLoader {
  private schemaParser: typeof schemaParser;
  private toolPromises: Map<string, Promise<Tool[]>> = new Map();

  constructor(private schemas: Map<string, string>) {}

  async getTool(schemaName: string, toolName: string): Promise<Tool> {
    if (!this.toolPromises.has(schemaName)) {
      const schema = this.schemas.get(schemaName);
      if (!schema) {
        throw new Error(`Schema ${schemaName} not found`);
      }

      this.toolPromises.set(schemaName, schemaParser(schema));
    }

    const tools = await this.toolPromises.get(schemaName)!;
    const tool = tools.find(t => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool ${toolName} not found in schema ${schemaName}`);
    }

    return tool;
  }
}

// Usage
const loader = new LazyToolLoader(new Map([
  ['user-service', userServiceSchema],
  ['product-service', productServiceSchema],
]));

// Tools are only parsed when first requested
const userTool = await loader.getTool('user-service', 'getUser');
```

### Batch Query Generation

```typescript
class BatchQueryGenerator {
  async generateBatch(requests: Array<{
    tool: Tool;
    args: any;
    outputSelection: any;
  }>): Promise<string> {
    const operations = await Promise.all(
      requests.map(async (req, index) => {
        const result = await req.tool.execution(req.args, req.outputSelection);
        return `
          query_${index}: ${result.query.replace('query ', '').replace('mutation ', '').replace('subscription ', '')}
        `;
      })
    );

    return `query BatchQuery {
      ${operations.join('\n')}
    }`;
  }
}

// Usage
const batchGenerator = new BatchQueryGenerator();
const tools = await schemaParser(schema);

const batchQuery = await batchGenerator.generateBatch([
  {
    tool: tools.find(t => t.name === 'getUser')!,
    args: { id: "123" },
    outputSelection: { id: true, username: true }
  },
  {
    tool: tools.find(t => t.name === 'getPosts')!,
    args: { userId: "123" },
    outputSelection: { id: true, title: true }
  }
]);
```

This advanced usage guide demonstrates how GraphQL MCP Bridge can be integrated into complex systems with proper error handling, caching, versioning, and performance optimization patterns.