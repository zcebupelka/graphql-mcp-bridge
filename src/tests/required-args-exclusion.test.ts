import { generateOutputSelectionSchemas } from "../generate-validation.ts";
import { describe, test } from "node:test";
import assert from "node:assert";
import { buildSchema } from "graphql";
import { readFileSync } from "fs";
import { join } from "path";
import { extractOperationsFromSchema, schemaParser } from "../schema-parser.ts";

describe('Fields with Required Arguments Exclusion', () => {
    let schema: any;
    let operations: any[];
    let outputSchemas: Record<string, any>;

    test('should exclude fields with required arguments from default selection', () => {
        // Load and parse the schema with fields that have required arguments
        const schemaPath = join(process.cwd(), 'src/tests/schema-samples/schema-with-fields.graphql');
        const graphqlSchemaString = readFileSync(schemaPath, 'utf-8');
        schema = buildSchema(graphqlSchemaString);

        // Extract operations
        operations = extractOperationsFromSchema(schema, { query: true, subscription: true, mutation: true, subscriptionPrefix: 'subscription' });

        // Generate output selection schemas
        outputSchemas = generateOutputSelectionSchemas(operations, schema);

        // Find the user operation
        const userSchema = outputSchemas['user'];
        assert.ok(userSchema, 'User operation schema should exist');

        // Test with empty selection to trigger default behavior
        const defaultSelection = userSchema.parse({});

        // Default selection should include simple scalar fields without arguments
        assert.strictEqual(defaultSelection.id, true, 'id field should be included (no args)');
        assert.strictEqual(defaultSelection.name, true, 'name field should be included (no args)');
        assert.strictEqual(defaultSelection.email, true, 'email field should be included (no args)');

        // Default selection should NOT include fields with required arguments
        assert.strictEqual(defaultSelection.hasPermission, undefined, 'hasPermission field should be excluded (has required args: resource, action)');
        assert.strictEqual(defaultSelection.posts, undefined, 'posts field should be excluded (has required arg: status)');
    });

    test('should allow manual inclusion of fields with required arguments when using schemaParser', async () => {
        // Load the schema
        const schemaPath = join(process.cwd(), 'src/tests/schema-samples/schema-with-fields.graphql');
        const graphqlSchemaString = readFileSync(schemaPath, 'utf-8');

        // Parse using the main function
        const result = await schemaParser(graphqlSchemaString);

        // Find the user query tool
        const userTool = result.find((tool: any) => tool.name === 'user');
        assert.ok(userTool, 'User tool should exist');

        // Test with empty selection (should use defaults)
        const queryResult = await userTool.execution({
            id: "123"
        }, {});

        const queryWithDefaults = queryResult.query;

        // Should not include fields with required arguments
        assert.ok(!queryWithDefaults.includes('hasPermission'), 'Default query should not include hasPermission field');
        assert.ok(!queryWithDefaults.includes('posts'), 'Default query should not include posts field');

        // Should include basic fields
        assert.ok(queryWithDefaults.includes('id'), 'Default query should include id field');
        assert.ok(queryWithDefaults.includes('name'), 'Default query should include name field');
        assert.ok(queryWithDefaults.includes('email'), 'Default query should include email field');

        // Test with manual selection including fields with arguments
        const manualSelection = {
            id: true,
            name: true,
            hasPermission: true,  // This should be allowed when manually specified
            posts: true           // This should be allowed when manually specified
        };

        const manualResult = await userTool.execution({
            id: "123"
        }, manualSelection);

        const queryWithManualSelection = manualResult.query;

        // Should include manually selected fields
        assert.ok(queryWithManualSelection.includes('hasPermission'), 'Manual query should include hasPermission when specified');
        assert.ok(queryWithManualSelection.includes('posts'), 'Manual query should include posts when specified');
    });

    test('should handle searchUsers operation which has required arguments', async () => {
        const schemaPath = join(process.cwd(), 'src/tests/schema-samples/schema-with-fields.graphql');
        const graphqlSchemaString = readFileSync(schemaPath, 'utf-8');

        const result = await schemaParser(graphqlSchemaString);

        // Find the searchUsers query tool
        const searchUsersTool = result.find((tool: any) => tool.name === 'searchUsers');
        assert.ok(searchUsersTool, 'SearchUsers tool should exist');

        // Test with empty selection for the array return type
        const queryResult = await searchUsersTool.execution({
            query: "test",
            limit: 5
        }, {});

        const queryWithDefaults = queryResult.query;

        // Should include default fields for User type but exclude fields with required args
        assert.ok(queryWithDefaults.includes('id'), 'Default query should include id field for User items');
        assert.ok(queryWithDefaults.includes('name'), 'Default query should include name field for User items');
        assert.ok(queryWithDefaults.includes('email'), 'Default query should include email field for User items');
        assert.ok(!queryWithDefaults.includes('hasPermission'), 'Default query should not include hasPermission field for User items');
        assert.ok(!queryWithDefaults.includes('posts'), 'Default query should not include posts field for User items');
    });

    test('should handle Post type fields with required arguments', () => {
        const schemaPath = join(process.cwd(), 'src/tests/schema-samples/schema-with-fields.graphql');
        const graphqlSchemaString = readFileSync(schemaPath, 'utf-8');
        schema = buildSchema(graphqlSchemaString);

        operations = extractOperationsFromSchema(schema, { query: true, subscription: true, mutation: true, subscriptionPrefix: 'subscription' });
        outputSchemas = generateOutputSelectionSchemas(operations, schema);

        // Test Post fields through User.posts selection
        const userSchema = outputSchemas['user'];

        // When manually selecting posts with nested Post fields
        const selectionWithPosts = {
            id: true,
            name: true,
            posts: {
                id: true,
                title: true,
                content: true,
                // isVisibleTo should not be included by default as it has required userId argument
            }
        };

        const result = userSchema.parse(selectionWithPosts);
        assert.ok(result, 'Should allow manual selection of posts with Post fields');

        // Verify that posts selection doesn't include isVisibleTo by default
        assert.strictEqual(result.posts.isVisibleTo, undefined, 'isVisibleTo should not be included in Post default selection');
    });

    test('should verify schema structure for fields with arguments', () => {
        const schemaPath = join(process.cwd(), 'src/tests/schema-samples/schema-with-fields.graphql');
        const graphqlSchemaString = readFileSync(schemaPath, 'utf-8');
        schema = buildSchema(graphqlSchemaString);

        // Check User type fields
        const userType = schema.getType('User');
        assert.ok(userType, 'User type should exist');

        const hasPermissionField = userType.getFields().hasPermission;
        assert.ok(hasPermissionField, 'hasPermission field should exist');
        assert.strictEqual(hasPermissionField.args.length, 2, 'hasPermission should have 2 arguments');
        assert.strictEqual(hasPermissionField.args[0].name, 'resource', 'First argument should be resource');
        assert.strictEqual(hasPermissionField.args[1].name, 'action', 'Second argument should be action');

        const postsField = userType.getFields().posts;
        assert.ok(postsField, 'posts field should exist');
        assert.strictEqual(postsField.args.length, 2, 'posts should have 2 arguments');
        assert.strictEqual(postsField.args[0].name, 'status', 'First argument should be status');
        assert.strictEqual(postsField.args[1].name, 'first', 'Second argument should be first');

        // Check Post type fields
        const postType = schema.getType('Post');
        assert.ok(postType, 'Post type should exist');

        const isVisibleToField = postType.getFields().isVisibleTo;
        assert.ok(isVisibleToField, 'isVisibleTo field should exist');
        assert.strictEqual(isVisibleToField.args.length, 1, 'isVisibleTo should have 1 argument');
        assert.strictEqual(isVisibleToField.args[0].name, 'userId', 'Argument should be userId');
    });
});