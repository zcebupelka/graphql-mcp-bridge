import { generateOutputSelectionSchemas } from "../generate-validation.ts";
import { describe, test } from "node:test";
import assert from "node:assert";
import { buildSchema } from "graphql";
import { readFileSync } from "fs";
import { join } from "path";
import { extractOperationsFromSchema } from "../schema-parser.ts";


describe('generateOutputSelectionSchemas', () => {
    let schema: any;
    let operations: any[];
    let outputSchemas: Record<string, any>;

    test('should generate output selection schemas from GraphQL schema', () => {
        // Load and parse the test schema
        const schemaPath = join(process.cwd(), 'src/tests/schema-samples/user-posts.graphql');
        const graphqlSchemaString = readFileSync(schemaPath, 'utf-8');
        schema = buildSchema(graphqlSchemaString);

        // Extract operations
        operations = extractOperationsFromSchema(schema);

        // Generate output selection schemas
        outputSchemas = generateOutputSelectionSchemas(operations, schema);

        assert.ok(outputSchemas);
        assert.ok(typeof outputSchemas === 'object');

        // Check that schemas exist for all operations
        const operationNames = operations.map(op => op.name);
        for (const operationName of operationNames) {
            assert.ok(outputSchemas[operationName], `Missing output schema for operation: ${operationName}`);
        }
    });

    test('should generate correct schema for User type queries', () => {
        const userSchema = outputSchemas['user'];
        const usersSchema = outputSchemas['users'];

        assert.ok(userSchema);
        assert.ok(usersSchema);

        // Test valid user selection
        const validUserSelection = {
            id: true,
            username: true,
            email: true,
            createdAt: false, // optional field can be false
            posts: {
                id: true,
                title: true,
                content: false
            }
        };

        // Should not throw
        const result = userSchema.parse(validUserSelection);
        assert.ok(result);

        // Test that users schema (array return type) has same structure as user schema
        const validUsersSelection = {
            id: true,
            username: true,
            email: true
        };

        const usersResult = usersSchema.parse(validUsersSelection);
        assert.ok(usersResult);
    });

    test('should generate correct schema for Post type queries', () => {
        const postSchema = outputSchemas['post'];
        const postsSchema = outputSchemas['posts'];

        assert.ok(postSchema);
        assert.ok(postsSchema);

        // Test valid post selection with nested user
        const validPostSelection = {
            id: true,
            title: true,
            content: true,
            published: true,
            postType: true, // enum field
            author: {
                id: true,
                username: true,
                email: false
            },
            createdAt: true
        };

        const result = postSchema.parse(validPostSelection);
        assert.ok(result);
    });

    test('should generate correct schema for mutation operations', () => {
        const createUserSchema = outputSchemas['createUser'];
        const createPostSchema = outputSchemas['createPost'];

        assert.ok(createUserSchema);
        assert.ok(createPostSchema);

        // Test mutation return type selection
        const validCreateUserSelection = {
            id: true,
            username: true,
            email: true,
            createdAt: true,
            posts: {
                id: true,
                title: true
            }
        };

        const result = createUserSchema.parse(validCreateUserSelection);
        assert.ok(result);
    });

    test('should handle scalar fields correctly', () => {
        const userSchema = outputSchemas['user'];

        // Test selection with only scalar fields
        const scalarSelection = {
            id: true,
            username: true,
            email: true,
            createdAt: true
        };

        const result = userSchema.parse(scalarSelection);
        assert.ok(result);

        // Test with boolean false values
        const falseSelection = {
            id: false,
            username: false,
            email: false,
            createdAt: false
        };

        const falseResult = userSchema.parse(falseSelection);
        assert.ok(falseResult);
    });

    test('should handle enum fields correctly', () => {
        const postSchema = outputSchemas['post'];

        // PostType is an enum field
        const enumSelection = {
            id: true,
            postType: true // enum field should accept boolean
        };

        const result = postSchema.parse(enumSelection);
        assert.ok(result);
    });

    test('should handle nested object selections', () => {
        const postSchema = outputSchemas['post'];

        // Test deeply nested selection
        const nestedSelection = {
            author: {
                posts: {
                    author: {
                        id: true,
                        username: true
                    }
                }
            }
        };

        const result = postSchema.parse(nestedSelection);
        assert.ok(result);
    });

    test('should reject invalid selection structures', () => {
        const userSchema = outputSchemas['user'];

        // Test invalid field types
        assert.throws(() => {
            userSchema.parse({
                id: "invalid", // should be boolean
                username: true
            });
        });

        // Test unknown fields (should be strict)
        assert.throws(() => {
            userSchema.parse({
                id: true,
                unknownField: true
            });
        });
    });

    test('should handle empty selections', () => {
        const userSchema = outputSchemas['user'];

        // Empty object should be valid (all fields are optional)
        const emptySelection = {};
        const result = userSchema.parse(emptySelection);
        assert.ok(result);
    });

    test('should handle list return types correctly', () => {
        const usersSchema = outputSchemas['users']; // Returns [User!]!
        const postsSchema = outputSchemas['posts']; // Returns [Post!]!

        // List types should have the same selection schema as their item types
        const userSelection = {
            id: true,
            username: true,
            posts: {
                id: true,
                title: true
            }
        };

        const usersResult = usersSchema.parse(userSelection);
        assert.ok(usersResult);

        const postSelection = {
            id: true,
            title: true,
            author: {
                id: true,
                username: true
            }
        };

        const postsResult = postsSchema.parse(postSelection);
        assert.ok(postsResult);
    });

    test('should validate complex nested structures', () => {
        const postSchema = outputSchemas['post'];

        // Complex selection with multiple nesting levels
        const complexSelection = {
            id: true,
            title: true,
            author: {
                id: true,
                username: true,
                posts: {
                    id: true,
                    title: true,
                    author: {
                        id: true,
                        email: true
                    }
                }
            }
        };

        const result = postSchema.parse(complexSelection);
        assert.ok(result);
    });
});