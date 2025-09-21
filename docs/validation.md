---
layout: default
title: Validation System
nav_order: 4
description: "Comprehensive validation with Zod for input arguments and output field selections"
---

# Validation System

GraphQL MCP Bridge includes a comprehensive validation system powered by Zod that ensures type safety at runtime. The validation system works on two levels: input validation for operation arguments and output validation for field selections.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

## Overview

The validation system provides:
- ✅ **Input Validation**: Automatic validation of operation arguments with type-safe Zod schemas
- ✅ **Output Selection Validation**: Validation of field selection objects to prevent selecting non-existent fields
- ✅ **Runtime Safety**: Built-in validation for all operations before execution
- ✅ **Type Safety**: Full TypeScript integration with comprehensive error handling
- ✅ **Circular Reference Protection**: Safe handling of self-referencing types

## Input Validation

All operation arguments are automatically validated against Zod schemas generated from the GraphQL schema:

### Basic Input Validation

```typescript
// The tool automatically validates input arguments
const result = await createUserTool.execution(
  { input: { username: "john", email: "john@example.com" } }, // ✅ Valid
  { id: true, username: true }
);

// This will throw a validation error
try {
  await createUserTool.execution(
    { input: { username: "john" } }, // ❌ Missing required email field
    { id: true, username: true }
  );
} catch (error) {
  console.error(error.message); // "Validation failed for createUser: ..."
}
```

### Scalar Type Validation

```typescript
const schema = `
  type Query {
    getUser(
      id: ID!,
      age: Int,
      rating: Float,
      isActive: Boolean,
      name: String
    ): User
  }
`;

const tools = await schemaParser(schema);
const getUserTool = tools[0];

// Valid input
await getUserTool.execution({
  id: "123",           // ID type
  age: 25,             // Int type
  rating: 4.5,         // Float type
  isActive: true,      // Boolean type
  name: "John"         // String type
}, {});

// Invalid input - will throw validation error
try {
  await getUserTool.execution({
    id: "123",
    age: "twenty-five", // ❌ Should be Int, not String
    rating: true,       // ❌ Should be Float, not Boolean
    isActive: "yes"     // ❌ Should be Boolean, not String
  }, {});
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

### Enum Validation

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

// Valid enum value
await getUsersByRoleTool.execution(
  { role: "ADMIN" }, // ✅ Valid enum value
  { id: true, username: true }
);

// Invalid enum value - will throw validation error
try {
  await getUsersByRoleTool.execution(
    { role: "INVALID_ROLE" }, // ❌ Not a valid enum value
    { id: true, username: true }
  );
} catch (error) {
  console.error('Invalid enum value:', error.message);
}
```

### Complex Input Objects

```typescript
const schema = `
  input CreateUserInput {
    username: String!
    email: String!
    profile: ProfileInput
    tags: [String!]
  }

  input ProfileInput {
    firstName: String
    lastName: String
    age: Int
  }

  type Mutation {
    createUser(input: CreateUserInput!): User
  }
`;

const tools = await schemaParser(schema, { mutation: true });
const createUserTool = tools[0];

// Valid complex input
await createUserTool.execution({
  input: {
    username: "johndoe",
    email: "john@example.com",
    profile: {
      firstName: "John",
      lastName: "Doe",
      age: 30
    },
    tags: ["developer", "typescript"]
  }
}, { id: true, username: true });

// Invalid nested input - will throw validation error
try {
  await createUserTool.execution({
    input: {
      username: "johndoe",
      email: "john@example.com",
      profile: {
        firstName: "John",
        lastName: "Doe",
        age: "thirty" // ❌ Should be Int, not String
      }
    }
  }, { id: true, username: true });
} catch (error) {
  console.error('Nested validation failed:', error.message);
}
```

## Output Selection Validation

Field selection objects are validated to ensure you only select existing fields:

### Basic Field Selection

```typescript
// Valid field selection
const result = await getUserTool.execution(
  { id: "123" },
  {
    id: true,        // ✅ Valid field
    username: true,  // ✅ Valid field
    email: true      // ✅ Valid field
  }
);

// This will throw a validation error
try {
  await getUserTool.execution(
    { id: "123" },
    { nonExistentField: true } // ❌ Field doesn't exist in schema
  );
} catch (error) {
  console.error(error.message); // Output selection validation failed
}
```

### Nested Field Selection

```typescript
const schema = `
  type User {
    id: ID!
    username: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    comments: [Comment!]!
  }

  type Comment {
    id: ID!
    content: String!
    author: User!
  }
`;

// Valid nested selection
await getUserTool.execution(
  { id: "123" },
  {
    id: true,
    username: true,
    posts: {
      id: true,
      title: true,
      comments: {
        id: true,
        content: true
      }
    }
  }
);

// Invalid nested selection - will throw validation error
try {
  await getUserTool.execution(
    { id: "123" },
    {
      id: true,
      posts: {
        invalidField: true // ❌ Field doesn't exist on Post type
      }
    }
  );
} catch (error) {
  console.error('Invalid nested field:', error.message);
}
```

### Union and Interface Selection

```typescript
const schema = `
  interface Node {
    id: ID!
  }

  type User implements Node {
    id: ID!
    username: String!
  }

  type Post implements Node {
    id: ID!
    title: String!
  }

  union SearchResult = User | Post

  type Query {
    search(query: String!): [SearchResult!]!
  }
`;

// Valid union selection with fragments
await searchTool.execution(
  { query: "example" },
  {
    "... on User": {
      id: true,
      username: true
    },
    "... on Post": {
      id: true,
      title: true
    }
  }
);
```

## Manual Validation

You can also use the validation functions directly:

### Validating Arguments

```typescript
import {
  validateOperationArguments,
  generateInputSchemas,
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
```

### Validating Output Selection

```typescript
// Validate output selection manually
try {
  const validatedSelection = userTool.outputSchema.parse({
    id: true,
    username: true,
    posts: { title: true }
  });
  console.log('Selection is valid:', validatedSelection);
} catch (error) {
  console.error('Invalid selection:', error.message);
}
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

## Supported Validation Features

### Data Types
- ✅ **Scalar Types**: String, Int, Float, Boolean, ID with proper type checking
- ✅ **Enum Validation**: Ensures only valid enum values are accepted
- ✅ **Complex Input Objects**: Nested input validation with proper type checking
- ✅ **List Types**: Array validation with item type checking
- ✅ **Non-null Types**: Required field validation
- ✅ **Optional Fields**: Proper handling of nullable fields

### Advanced Features
- ✅ **Circular References**: Safe handling without infinite recursion
- ✅ **Union Types**: Validation for fragment selections
- ✅ **Interface Types**: Validation for interface implementations
- ✅ **Custom Scalars**: Basic validation for custom scalar types
- ✅ **Input Type Recursion**: Proper handling of recursive input types

### Error Handling
- ✅ **Detailed Error Messages**: Clear descriptions of validation failures
- ✅ **Field Path Information**: Specific location of validation errors in nested objects
- ✅ **Type Mismatch Details**: Exact information about expected vs. actual types
- ✅ **Multiple Error Reporting**: All validation errors reported at once

## Error Examples

### Input Validation Errors

```typescript
// Missing required field
try {
  await createUserTool.execution({
    input: { username: "john" } // Missing required email
  }, {});
} catch (error) {
  console.log(error.message);
  // Output: "Validation failed for input.email: Required"
}

// Wrong type
try {
  await getUserTool.execution({
    id: 123 // Should be string for ID type
  }, {});
} catch (error) {
  console.log(error.message);
  // Output: "Validation failed for id: Expected string, received number"
}
```

### Output Selection Errors

```typescript
// Non-existent field
try {
  await getUserTool.execution({ id: "123" }, {
    nonExistentField: true
  });
} catch (error) {
  console.log(error.message);
  // Output: "Field 'nonExistentField' does not exist on type 'User'"
}

// Invalid nested selection
try {
  await getUserTool.execution({ id: "123" }, {
    posts: {
      invalidField: true
    }
  });
} catch (error) {
  console.log(error.message);
  // Output: "Field 'invalidField' does not exist on type 'Post'"
}
```

## Best Practices

1. **Always Handle Validation Errors**: Wrap tool executions in try-catch blocks
2. **Use TypeScript**: Leverage full TypeScript support for compile-time safety
3. **Test Edge Cases**: Validate your schemas with various input combinations
4. **Check Schema Compatibility**: Ensure your GraphQL schema types are compatible with Zod
5. **Monitor Performance**: Validation adds runtime overhead; consider caching for frequently used tools
6. **Provide Good Error Messages**: Use validation errors to provide helpful feedback to users