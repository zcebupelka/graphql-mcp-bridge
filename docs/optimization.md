---
layout: default
title: Optimization Guide
nav_order: 6
description: "Memory optimization, performance tips, and handling large GraphQL schemas"
---

# Optimization Guide

When working with large GraphQL schemas, memory optimization and performance become crucial. This guide covers strategies for handling very large schemas and optimizing performance.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

## Memory Optimization for Large Schemas

When working with very large GraphQL schemas (like GitHub's 70K+ line schema), memory optimization becomes crucial. The library provides several configuration options to prevent JavaScript heap out of memory errors.

### Memory Optimization Options

The following configuration options help control memory usage:

- **`maxOperations`**: Limits the number of operations processed (default: 200)
- **`maxOperationArgs`**: Limits arguments per operation (default: 50)
- **`maxSchemaDepth`**: Prevents deep recursion in nested types (default: 10)
- **`maxFields`**: Limits fields processed per type (default: 100)

### Basic Memory Optimization

```typescript
import { schemaParser } from 'graphql-mcp-bridge';

// Memory optimization for large schemas
const optimizedTools = await schemaParser(schema, {
  query: true,
  mutation: true,
  maxOperations: 100,        // Limit total operations
  maxOperationArgs: 20,      // Limit arguments per operation
  maxSchemaDepth: 5,         // Limit recursion depth
  maxFields: 50              // Limit fields per type
});

console.log(`Generated ${optimizedTools.length} tools from large schema`);
```

### Example: GitHub GraphQL API

GitHub's GraphQL API is one of the largest public GraphQL schemas available. Here's how to handle it efficiently:

```typescript
import { schemaParser } from 'graphql-mcp-bridge';

// Optimized configuration for GitHub's large schema
const tools = await schemaParser(githubSchema, {
  query: true,
  mutation: false,           // Skip mutations to reduce memory usage
  subscription: false,       // Skip subscriptions
  maxOperations: 50,         // Very conservative limit
  maxOperationArgs: 10,      // Limit complex operations
  maxSchemaDepth: 3,         // Shallow processing
  maxFields: 30,             // Limit fields per type
  ignorePhrase: 'DEPRECATED' // Skip deprecated operations
});

console.log(`Generated ${tools.length} tools from GitHub schema`);
```

### Memory-Efficient Batch Processing

For extremely large schemas, use memory-efficient batch processing:

```typescript
import { parseSchemaInBatches } from 'graphql-mcp-bridge';

// Process in small batches with memory cleanup
const tools = await parseSchemaInBatches(massiveSchema, {
  query: true,
  mutation: false,
  batchSize: 20,              // Process 20 operations at a time
  maxOperations: 100,         // Overall limit
  maxOperationArgs: 15,       // Conservative argument limit
  maxSchemaDepth: 3,          // Very shallow processing
  maxFields: 25               // Strict field limit
});
```

### Memory Management Utilities

The library provides utilities for monitoring and managing memory usage:

```typescript
import {
  clearTypeSchemaCache,
  getTypeSchemaCacheSize,
  clearValidationCache,
  getValidationCacheSize
} from 'graphql-mcp-bridge';

// Monitor cache sizes
console.log(`Type schema cache: ${getTypeSchemaCacheSize()} schemas`);
console.log(`Validation cache: ${getValidationCacheSize()} validators`);

// Clear caches to free memory
clearTypeSchemaCache();
clearValidationCache();

// Monitor memory usage
function logMemoryUsage(label: string) {
  const used = process.memoryUsage();
  console.log(`${label} - Memory usage:`, {
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(used.external / 1024 / 1024)} MB`
  });
}

logMemoryUsage('Before schema parsing');
const tools = await schemaParser(largeSchema, optimizedConfig);
logMemoryUsage('After schema parsing');

clearTypeSchemaCache();
clearValidationCache();
logMemoryUsage('After cache clear');
```

## Performance Optimization Tips

### 1. Start Conservative

Begin with very conservative limits and increase gradually:

```typescript
// Start with minimal configuration
const minimalConfig = {
  query: true,
  mutation: false,
  subscription: false,
  maxOperations: 25,
  maxOperationArgs: 5,
  maxSchemaDepth: 2,
  maxFields: 15
};

// Test with minimal config first
const tools = await schemaParser(schema, minimalConfig);

// Gradually increase limits based on needs and memory constraints
```

### 2. Skip Complex Operations

Use `ignorePhrase` to skip complex or deprecated operations:

```typescript
const tools = await schemaParser(schema, {
  query: true,
  maxOperations: 100,
  ignorePhrase: 'DEPRECATED|COMPLEX|INTERNAL' // Skip multiple types
});
```

### 3. Limit Operation Types

Process only the operation types you need:

```typescript
// Read-only use case - only queries
const readOnlyTools = await schemaParser(schema, {
  query: true,
  mutation: false,
  subscription: false
});

// Write operations only
const writeOnlyTools = await schemaParser(schema, {
  query: false,
  mutation: true,
  subscription: false
});
```

### 4. Monitor Memory Usage

Use Node.js built-in memory monitoring:

```typescript
// Set memory limit
// node --max-old-space-size=4096 your-script.js

// Monitor heap usage
const heapUsed = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(`Heap used: ${Math.round(heapUsed)} MB`);

// Set up memory warnings
process.on('exit', () => {
  const finalMemory = process.memoryUsage();
  console.log('Final memory usage:', {
    rss: `${Math.round(finalMemory.rss / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(finalMemory.heapUsed / 1024 / 1024)} MB`
  });
});
```

### 5. Use Streaming for Very Large Schemas

For schemas that are too large to process in memory:

```typescript
import { createReadStream } from 'fs';
import { parseSchemaStream } from 'graphql-mcp-bridge';

// Stream processing for very large schema files
const schemaStream = createReadStream('huge-schema.graphql');
const tools = await parseSchemaStream(schemaStream, {
  query: true,
  maxOperations: 50,
  processInChunks: true,
  chunkSize: 1000000 // 1MB chunks
});
```

## Progressive Schema Loading

For applications that need to handle multiple large schemas:

```typescript
class ProgressiveSchemaLoader {
  private loadedSchemas = new Map<string, Tool[]>();
  private loadingPromises = new Map<string, Promise<Tool[]>>();

  async loadSchema(
    schemaName: string,
    schema: string,
    config: Config = {}
  ): Promise<Tool[]> {
    // Check if already loaded
    if (this.loadedSchemas.has(schemaName)) {
      return this.loadedSchemas.get(schemaName)!;
    }

    // Check if currently loading
    if (this.loadingPromises.has(schemaName)) {
      return this.loadingPromises.get(schemaName)!;
    }

    // Start loading
    const loadingPromise = this.parseWithRetry(schema, config);
    this.loadingPromises.set(schemaName, loadingPromise);

    try {
      const tools = await loadingPromise;
      this.loadedSchemas.set(schemaName, tools);
      return tools;
    } finally {
      this.loadingPromises.delete(schemaName);
    }
  }

  private async parseWithRetry(
    schema: string,
    config: Config,
    maxRetries: number = 3
  ): Promise<Tool[]> {
    let attempt = 0;
    let lastError: Error;

    while (attempt < maxRetries) {
      try {
        return await schemaParser(schema, {
          ...config,
          // Reduce limits on retries
          maxOperations: config.maxOperations ?
            Math.floor(config.maxOperations * (0.7 ** attempt)) :
            Math.floor(200 * (0.7 ** attempt)),
          maxFields: config.maxFields ?
            Math.floor(config.maxFields * (0.8 ** attempt)) :
            Math.floor(100 * (0.8 ** attempt))
        });
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (error.message.includes('heap out of memory')) {
          // Clear caches before retry
          clearTypeSchemaCache();
          clearValidationCache();

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }
    }

    throw new Error(`Failed to parse schema after ${maxRetries} attempts: ${lastError.message}`);
  }

  unloadSchema(schemaName: string): void {
    this.loadedSchemas.delete(schemaName);
    // Trigger garbage collection hint
    if (global.gc) {
      global.gc();
    }
  }

  getLoadedSchemas(): string[] {
    return Array.from(this.loadedSchemas.keys());
  }

  getTotalToolCount(): number {
    return Array.from(this.loadedSchemas.values())
      .reduce((total, tools) => total + tools.length, 0);
  }
}

// Usage
const loader = new ProgressiveSchemaLoader();

// Load schemas progressively
const userTools = await loader.loadSchema('user-service', userSchema, {
  query: true,
  maxOperations: 50
});

const productTools = await loader.loadSchema('product-service', productSchema, {
  query: true,
  mutation: true,
  maxOperations: 30
});

console.log(`Loaded ${loader.getTotalToolCount()} tools across ${loader.getLoadedSchemas().length} schemas`);

// Unload when done
loader.unloadSchema('user-service');
```

## Schema Analysis and Optimization

Analyze your schema before processing to make informed optimization decisions:

```typescript
import { analyzeSchema } from 'graphql-mcp-bridge';

// Analyze schema characteristics
const analysis = await analyzeSchema(schema);

console.log('Schema Analysis:', {
  totalOperations: analysis.operationCount,
  avgArgumentsPerOperation: analysis.avgArgumentsPerOperation,
  maxDepth: analysis.maxNestingDepth,
  complexTypes: analysis.complexTypeCount,
  estimatedMemoryUsage: analysis.estimatedMemoryUsageMB
});

// Use analysis to configure parser
const config = {
  query: true,
  mutation: analysis.operationCount.mutations < 50, // Only if manageable
  maxOperations: Math.min(100, analysis.operationCount.queries),
  maxOperationArgs: Math.min(20, analysis.avgArgumentsPerOperation * 2),
  maxSchemaDepth: Math.min(8, analysis.maxNestingDepth),
  maxFields: analysis.complexTypeCount > 100 ? 30 : 50
};

const tools = await schemaParser(schema, config);
```

## Best Practices Summary

1. **Start Small**: Begin with conservative limits and increase gradually
2. **Monitor Memory**: Use Node.js memory monitoring and the library's cache utilities
3. **Skip Unnecessary Operations**: Use `ignorePhrase` and operation type selection
4. **Use Batch Processing**: For very large schemas, process in batches
5. **Clear Caches**: Regularly clear caches to free memory
6. **Set Memory Limits**: Use Node.js `--max-old-space-size` flag
7. **Analyze First**: Use schema analysis to inform your optimization strategy
8. **Test Thoroughly**: Test with realistic data sizes and usage patterns

## Troubleshooting Common Issues

### JavaScript Heap Out of Memory

```bash
# Increase heap size
node --max-old-space-size=8192 your-script.js

# Or set via environment
export NODE_OPTIONS="--max-old-space-size=8192"
```

### Slow Performance

```typescript
// Profile performance
console.time('schema-parsing');
const tools = await schemaParser(schema, config);
console.timeEnd('schema-parsing');

// Use smaller limits
const fasterConfig = {
  query: true,
  maxOperations: 25,
  maxSchemaDepth: 3,
  maxFields: 20
};
```

### Out of Memory During Validation

```typescript
// Disable validation caching for very large schemas
const tools = await schemaParser(schema, {
  query: true,
  disableValidationCache: true,
  maxOperations: 50
});
```

This optimization guide provides strategies for handling large schemas efficiently while maintaining the functionality you need from GraphQL MCP Bridge.