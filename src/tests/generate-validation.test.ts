import { describe, test } from 'node:test';
import assert from 'node:assert';
import { schemaParser } from '../schema-parser.ts';
import { readFileSync } from 'fs';
import { join } from 'path';
import { generateOutputSelectionSchemas, validateOperationArguments } from '../generate-validation.ts';

const config = { query: true, subscription: true, mutation: true, subscriptionPrefix: 'subscription' };
type Tool = {
    name: string;
    execution: (variables: any, selectedFields: any) => Promise<{
        query: string;
        variables: any;
    }>;
    description?: string;
    inputSchema?: any;
    outputSchema?: any;
};
describe('GraphQL Zod Validation', () => {
    let tools: Tool[];
    let validationSchemas: Record<string, any>;
    // Setup: Parse schema before running tests
    test('should parse GraphQL schema and generate tools with validation schemas', async () => {
        const schemaPath = join(process.cwd(), 'src/tests/schema-samples/user-posts.graphql');
        const graphqlSchema = readFileSync(schemaPath, 'utf-8');

        tools = await schemaParser(graphqlSchema, config);

        // Extract validation schemas from tools for backward compatibility with existing tests
        validationSchemas = {};
        for (const tool of tools) {
            if (tool.inputSchema) {
                validationSchemas[tool.name] = tool.inputSchema;
            }
        }

        assert.ok(tools);
        assert.ok(Array.isArray(tools));
        assert.ok(tools.length > 0);

        // Check that we have tools for our expected operations
        const toolNames = tools.map(tool => tool.name);
        assert.ok(toolNames.includes('users'));
        assert.ok(toolNames.includes('user'));
        assert.ok(toolNames.includes('createUser'));
        assert.ok(toolNames.includes('createPost'));

        // Check that tools have the correct structure
        const userTool = tools.find(tool => tool.name === 'user');
        assert.ok(userTool);
        assert.ok(typeof userTool.execution === 'function');
        assert.ok(userTool.description);
        assert.ok(userTool.inputSchema);
    });

    test('should validate query arguments correctly', () => {
        // Valid user query
        const validUserQuery = validateOperationArguments('user', {
            id: '123'
        }, validationSchemas);

        assert.deepStrictEqual(validUserQuery, { id: '123' });
    });

    test('should validate mutation arguments correctly', () => {
        // Valid createUser mutation
        const validCreateUser = validateOperationArguments('createUser', {
            input: {
                username: 'john_doe',
                email: 'john@example.com'
            }
        }, validationSchemas);

        assert.deepStrictEqual(validCreateUser, {
            input: {
                username: 'john_doe',
                email: 'john@example.com'
            }
        });
    });

    test('should reject invalid mutation arguments', () => {
        // Invalid createUser mutation - missing required email
        assert.throws(() => {
            validateOperationArguments('createUser', {
                input: {
                    username: 'john_doe'
                    // Missing email field
                }
            }, validationSchemas);
        }, /Validation failed/);
    });

    test('should reject invalid argument types', () => {
        // Invalid user query - id should be string, not number
        assert.throws(() => {
            validateOperationArguments('user', {
                id: 123
            }, validationSchemas);
        }, /Validation failed/);
    });

    test('should validate optional arguments correctly', () => {
        // updatePost with optional fields
        const validUpdatePost = validateOperationArguments('updatePost', {
            id: '123',
            title: 'New Title'
            // content is optional, so we don't include it
        }, validationSchemas);

        assert.deepStrictEqual(validUpdatePost, {
            id: '123',
            title: 'New Title'
        });
    });

    test('should validate operations with no arguments', () => {
        // users query has no arguments
        const validUsersQuery = validateOperationArguments('users', {}, validationSchemas);
        assert.deepStrictEqual(validUsersQuery, {});
    });

    test('should handle nested input objects', () => {
        // createPost with nested input
        const validCreatePost = validateOperationArguments('createPost', {
            input: {
                title: 'Test Post',
                content: 'This is a test post',
                authorId: '456'
            }
        }, validationSchemas);

        assert.deepStrictEqual(validCreatePost, {
            input: {
                title: 'Test Post',
                content: 'This is a test post',
                authorId: '456'
            }
        });
    });

    test('should throw error for unknown operation', () => {
        assert.throws(() => {
            validateOperationArguments('unknownOperation', {}, validationSchemas);
        }, /No validation schema found/);
    });

    test('should execute tool functions correctly', async () => {
        const userTool = tools.find(tool => tool.name === 'user');
        assert.ok(userTool);

        // Test successful execution
        const result = await userTool.execution({ id: '123' }, { id: true, username: true });
        assert.ok(result.query);
        assert.ok(result.variables);
        assert.strictEqual(result.variables.id, '123');
        assert.ok(result.query.includes('user'));
    });

    test('should validate input through tool execution', async () => {
        const createUserTool = tools.find(tool => tool.name === 'createUser');
        assert.ok(createUserTool);

        // Test with valid input
        const validResult = await createUserTool.execution({
            input: {
                username: 'john_doe',
                email: 'john@example.com'
            }
        }, {
            id: true
        });
        assert.ok(validResult.query);
        assert.ok(validResult.variables);

        // Test with invalid input - should throw
        await assert.rejects(async () => {
            await createUserTool.execution({
                input: {
                    username: 'john_doe'
                    // Missing required email
                }
            }, { id: true });
        });
    });

    test('should have proper tool metadata', () => {
        for (const tool of tools) {
            assert.ok(tool.name);
            assert.ok(typeof tool.execution === 'function');
            assert.ok(tool.description);
            // Input schema should exist for operations that have arguments
            if (tool.name !== 'users') { // users query has no arguments
                assert.ok(tool.inputSchema);
            }
        }
    });
});
