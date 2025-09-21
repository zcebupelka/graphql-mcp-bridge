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

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

## Features

- 🔗 **GraphQL to MCP Bridge**: Convert GraphQL schemas to MCP-compatible function definitions
- 📝 **Description Preservation**: Automatically preserves GraphQL field descriptions as tool descriptions
- ⚙️ **Flexible Configuration**: Selective operation generation with customizable naming patterns
- 🛡️ **Comprehensive Zod Validation**: Input validation and output field selection validation
- 🎯 **Smart Field Selection**: Dynamic field selection with support for nested objects, unions, and interfaces
- 🚀 **Query Generation**: Automatic GraphQL query string generation with variable handling
- 📝 **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- ⚙️ **Advanced Schema Support**: Handles enums, interfaces, unions, complex inputs, and nested types
- ⚡ **Runtime Safety**: Built-in validation for all operations before execution

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

// Use the generated tools
const userTool = tools.find(tool => tool.name === 'user');

// The tool automatically validates inputs and field selections
const result = await userTool.execution(
  { id: "123" }, // Variables - validated against input schema
  { id: true, username: true, posts: { title: true } } // Field selection - validated against output schema
);

console.log(result.query);
// Output: query user($id: ID!) { user(id: $id) { id username posts { title } } }
```

## Documentation

### 📚 Complete Documentation

- **[Getting Started](docs/getting-started.md)** - Installation, quick start, and basic usage examples
- **[Configuration](docs/configuration.md)** - Comprehensive configuration options and customization
- **[Validation System](docs/validation.md)** - Input validation, output validation, and error handling
- **[Advanced Usage](docs/advanced-usage.md)** - Complex examples, integration patterns, and advanced features
- **[Optimization Guide](docs/optimization.md)** - Memory optimization and performance tips for large schemas

### 🚀 Key Topics

- **Schema Conversion**: Transform GraphQL schemas into MCP-compatible tools
- **Type Safety**: Comprehensive validation with Zod for both inputs and outputs
- **Flexible Configuration**: Control which operations are generated and how they're named
- **Large Schema Support**: Handle massive schemas like GitHub's GraphQL API efficiently
- **Integration Patterns**: Best practices for integrating with MCP servers

## Installation

```bash
npm install graphql-mcp-bridge
# or
pnpm install graphql-mcp-bridge
# or
yarn add graphql-mcp-bridge
```

## Why GraphQL MCP Bridge?

GraphQL MCP Bridge solves the challenge of connecting GraphQL APIs with AI systems through the Model Context Protocol. It provides:

1. **Automatic Tool Generation**: Convert any GraphQL schema into MCP tools without manual mapping
2. **Type Safety**: Full runtime validation ensures your AI systems interact with GraphQL APIs safely
3. **Intelligent Field Selection**: Prevent over-fetching by validating field selections against your schema
4. **Production Ready**: Handle large, complex schemas with memory optimization and performance features
5. **Developer Experience**: Full TypeScript support with comprehensive error handling

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.