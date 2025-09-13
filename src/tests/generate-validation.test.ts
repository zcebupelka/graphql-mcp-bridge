import { describe, test } from 'node:test';
import assert from 'node:assert';
import { schemaParser } from '../index.ts';
import { readFileSync } from 'fs';
import { join } from 'path';
import { validateOperationArguments } from '../generate-validation.ts';

describe('GraphQL Zod Validation', () => {
    let validationSchemas: Record<string, any>;

    // Setup: Parse schema before running tests
    test('should parse GraphQL schema and generate validation schemas', async () => {
        const schemaPath = join(process.cwd(), 'src/tests/schema-samples/user-posts.graphql');
        const graphqlSchema = readFileSync(schemaPath, 'utf-8');

        const result = await schemaParser(graphqlSchema);
        validationSchemas = result.validationSchemas;

        assert.ok(validationSchemas);
        assert.ok(Object.keys(validationSchemas).length > 0);

        // Check that we have validation schemas for our expected operations
        assert.ok(validationSchemas.users);
        assert.ok(validationSchemas.user);
        assert.ok(validationSchemas.createUser);
        assert.ok(validationSchemas.createPost);
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
});
