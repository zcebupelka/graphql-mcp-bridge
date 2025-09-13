import { describe, test } from 'node:test';
import assert from 'node:assert';
import { generateQueryString } from '../generate-query-string.ts';

describe('generateQueryString', () => {
    const sampleOperation = {
        name: 'getUser',
        type: 'query' as const,
        args: [
            { name: 'id', type: 'ID!' },
            { name: 'includeActive', type: 'Boolean' }
        ]
    };

    const sampleVariables = { id: '123', includeActive: true };

    test('generates basic query without field selection', () => {
        const result = generateQueryString(sampleOperation, sampleVariables);
        assert.strictEqual(result, 'query getUser($id: ID!, $includeActive: Boolean) { getUser(id: $id, includeActive: $includeActive) }');
    });

    test('generates query with simple field selection', () => {
        const fieldSelection = {
            id: true,
            username: true,
            email: false // should be excluded
        };

        const result = generateQueryString(sampleOperation, sampleVariables, fieldSelection);
        assert.strictEqual(result, 'query getUser($id: ID!, $includeActive: Boolean) { getUser(id: $id, includeActive: $includeActive) { id username } }');
    });

    test('generates query with nested field selection', () => {
        const fieldSelection = {
            id: true,
            username: true,
            posts: {
                id: true,
                title: true,
                content: false,
                author: {
                    id: true,
                    name: true
                }
            }
        };

        const result = generateQueryString(sampleOperation, sampleVariables, fieldSelection);
        assert.strictEqual(result, 'query getUser($id: ID!, $includeActive: Boolean) { getUser(id: $id, includeActive: $includeActive) { id username posts { id title author { id name } } } }');
    });

    test('generates mutation with field selection', () => {
        const mutationOperation = {
            name: 'createUser',
            type: 'mutation' as const,
            args: [
                { name: 'input', type: 'UserInput!' }
            ]
        };

        const fieldSelection = {
            id: true,
            username: true,
            createdAt: true
        };

        const result = generateQueryString(mutationOperation, { input: {} }, fieldSelection);
        assert.strictEqual(result, 'mutation createUser($input: UserInput!) { createUser(input: $input) { id username createdAt } }');
    });

    test('generates subscription with field selection', () => {
        const subscriptionOperation = {
            name: 'userUpdates',
            type: 'subscription' as const,
            args: [
                { name: 'userId', type: 'ID!' }
            ]
        };

        const fieldSelection = {
            id: true,
            username: true,
            lastSeen: true
        };

        const result = generateQueryString(subscriptionOperation, { userId: '123' }, fieldSelection);
        assert.strictEqual(result, 'subscription userUpdates($userId: ID!) { userUpdates(userId: $userId) { id username lastSeen } }');
    });

    test('handles empty field selection', () => {
        const fieldSelection = {};
        const result = generateQueryString(sampleOperation, sampleVariables, fieldSelection);
        assert.strictEqual(result, 'query getUser($id: ID!, $includeActive: Boolean) { getUser(id: $id, includeActive: $includeActive) }');
    });

    test('handles field selection with only false values', () => {
        const fieldSelection = {
            id: false,
            username: false,
            email: false
        };
        const result = generateQueryString(sampleOperation, sampleVariables, fieldSelection);
        assert.strictEqual(result, 'query getUser($id: ID!, $includeActive: Boolean) { getUser(id: $id, includeActive: $includeActive) }');
    });

    test('handles operation with no arguments', () => {
        const noArgsOperation = {
            name: 'getAllUsers',
            type: 'query' as const,
            args: []
        };

        const fieldSelection = {
            id: true,
            username: true
        };

        const result = generateQueryString(noArgsOperation, {}, fieldSelection);
        assert.strictEqual(result, 'query getAllUsers() { getAllUsers() { id username } }');
    });

    test('throws error for unknown operation type', () => {
        const invalidOperation = {
            name: 'test',
            type: 'invalid' as any,
            args: []
        };

        assert.throws(() => generateQueryString(invalidOperation, {}), /Unknown operation type: invalid/);
    });

    test('throws error for missing required variables', () => {
        const operationWithRequiredArgs = {
            name: 'deleteUser',
            type: 'mutation' as const,
            args: [
                { name: 'id', type: 'ID!' },
                { name: 'confirmDelete', type: 'Boolean!' }
            ]
        };

        // Missing required variables
        assert.throws(() => generateQueryString(operationWithRequiredArgs, {}), /Missing required variable: id/);
        assert.throws(() => generateQueryString(operationWithRequiredArgs, { id: '123' }), /Missing required variable: confirmDelete/);
    });

    test('allows missing optional variables', () => {
        const operationWithOptionalArgs = {
            name: 'getUsers',
            type: 'query' as const,
            args: [
                { name: 'limit', type: 'Int' },
                { name: 'offset', type: 'Int' },
                { name: 'filter', type: 'String' }
            ]
        };

        // Should not throw for missing optional variables
        const result = generateQueryString(operationWithOptionalArgs, { limit: 10 });
        assert.strictEqual(result, 'query getUsers($limit: Int, $offset: Int, $filter: String) { getUsers(limit: $limit, offset: $offset, filter: $filter) }');
    });

    test('warns about unused variables', () => {
        const consoleWarnSpy: string[] = [];
        const originalWarn = console.warn;
        console.warn = (message: string) => consoleWarnSpy.push(message);

        try {
            const result = generateQueryString(sampleOperation, {
                id: '123',
                includeActive: true,
                unusedVar: 'test',
                anotherUnused: 42
            });

            assert.strictEqual(result, 'query getUser($id: ID!, $includeActive: Boolean) { getUser(id: $id, includeActive: $includeActive) }');
            assert.strictEqual(consoleWarnSpy.length, 2);
            assert(consoleWarnSpy.some(msg => msg.includes('unusedVar')));
            assert(consoleWarnSpy.some(msg => msg.includes('anotherUnused')));
        } finally {
            console.warn = originalWarn;
        }
    });

    test('handles complex nested field selections with mixed types', () => {
        const complexFieldSelection = {
            id: true,
            username: true,
            profile: {
                bio: true,
                avatar: false,
                settings: {
                    theme: true,
                    notifications: {
                        email: true,
                        push: false,
                        sms: true
                    }
                }
            },
            posts: {
                id: true,
                title: true,
                tags: true,
                comments: {
                    id: true,
                    text: true,
                    author: {
                        id: true,
                        username: true
                    }
                }
            },
            followers: false
        };

        const result = generateQueryString(sampleOperation, sampleVariables, complexFieldSelection);
        const expected = 'query getUser($id: ID!, $includeActive: Boolean) { getUser(id: $id, includeActive: $includeActive) { id username profile { bio settings { theme notifications { email sms } } } posts { id title tags comments { id text author { id username } } } } }';
        assert.strictEqual(result, expected);
    });

    test('handles operations with various GraphQL types', () => {
        const complexOperation = {
            name: 'createPost',
            type: 'mutation' as const,
            args: [
                { name: 'title', type: 'String!' },
                { name: 'content', type: 'String!' },
                { name: 'tags', type: '[String!]' },
                { name: 'publishedAt', type: 'DateTime' },
                { name: 'metadata', type: 'PostMetadataInput' },
                { name: 'isDraft', type: 'Boolean' }
            ]
        };

        const variables = {
            title: 'My Post',
            content: 'Post content',
            tags: ['tech', 'programming'],
            publishedAt: '2025-09-13T18:00:00Z',
            metadata: { category: 'tech' }
        };

        const fieldSelection = {
            id: true,
            title: true,
            slug: true,
            publishedAt: true
        };

        const result = generateQueryString(complexOperation, variables, fieldSelection);
        const expected = 'mutation createPost($title: String!, $content: String!, $tags: [String!], $publishedAt: DateTime, $metadata: PostMetadataInput, $isDraft: Boolean) { createPost(title: $title, content: $content, tags: $tags, publishedAt: $publishedAt, metadata: $metadata, isDraft: $isDraft) { id title slug publishedAt } }';
        assert.strictEqual(result, expected);
    });

    test('handles deeply nested field selections', () => {
        const deeplyNested = {
            level1: {
                level2: {
                    level3: {
                        level4: {
                            level5: {
                                deepField: true,
                                anotherDeepField: true
                            },
                            otherField: false
                        },
                        skippedLevel3: false
                    },
                    level3Alt: {
                        field: true
                    }
                },
                level2Alt: true
            }
        };

        const result = generateQueryString(sampleOperation, sampleVariables, deeplyNested);
        const expected = 'query getUser($id: ID!, $includeActive: Boolean) { getUser(id: $id, includeActive: $includeActive) { level1 { level2 { level3 { level4 { level5 { deepField anotherDeepField } } } level3Alt { field } } level2Alt } } }';
        assert.strictEqual(result, expected);
    });

    test('handles field selection with null and undefined values', () => {
        const fieldSelectionWithNullish = {
            id: true,
            username: null as any,
            email: undefined as any,
            profile: {
                bio: true,
                avatar: null as any,
                settings: undefined as any
            }
        };

        const result = generateQueryString(sampleOperation, sampleVariables, fieldSelectionWithNullish);
        // null and undefined should be treated as false and excluded
        assert.strictEqual(result, 'query getUser($id: ID!, $includeActive: Boolean) { getUser(id: $id, includeActive: $includeActive) { id profile { bio } } }');
    });

    test('handles operations with special characters in names', () => {
        const operationWithSpecialChars = {
            name: 'get_user_by_email',
            type: 'query' as const,
            args: [
                { name: 'email_address', type: 'String!' },
                { name: 'include_inactive', type: 'Boolean' }
            ]
        };

        const variables = {
            email_address: 'test@example.com',
            include_inactive: false
        };

        const result = generateQueryString(operationWithSpecialChars, variables);
        assert.strictEqual(result, 'query get_user_by_email($email_address: String!, $include_inactive: Boolean) { get_user_by_email(email_address: $email_address, include_inactive: $include_inactive) }');
    });

    test('handles empty nested objects in field selection', () => {
        const fieldSelectionWithEmptyNested = {
            id: true,
            username: true,
            posts: {},
            profile: {
                settings: {}
            },
            emptyNested: {
                innerEmpty: {}
            }
        };

        const result = generateQueryString(sampleOperation, sampleVariables, fieldSelectionWithEmptyNested);
        // Empty nested objects should not appear in the output
        assert.strictEqual(result, 'query getUser($id: ID!, $includeActive: Boolean) { getUser(id: $id, includeActive: $includeActive) { id username } }');
    });

    test('handles operations with no variables provided when all args are optional', () => {
        const allOptionalOperation = {
            name: 'getUsers',
            type: 'query' as const,
            args: [
                { name: 'limit', type: 'Int' },
                { name: 'offset', type: 'Int' }
            ]
        };

        const result = generateQueryString(allOptionalOperation, {});
        assert.strictEqual(result, 'query getUsers($limit: Int, $offset: Int) { getUsers(limit: $limit, offset: $offset) }');
    });

    test('handles mixed required and optional arguments with partial variables', () => {
        const mixedOperation = {
            name: 'searchUsers',
            type: 'query' as const,
            args: [
                { name: 'query', type: 'String!' },
                { name: 'limit', type: 'Int' },
                { name: 'includeInactive', type: 'Boolean!' },
                { name: 'sortBy', type: 'String' }
            ]
        };

        const partialVariables = {
            query: 'john',
            includeInactive: false,
            sortBy: 'name'
        };

        const result = generateQueryString(mixedOperation, partialVariables);
        assert.strictEqual(result, 'query searchUsers($query: String!, $limit: Int, $includeInactive: Boolean!, $sortBy: String) { searchUsers(query: $query, limit: $limit, includeInactive: $includeInactive, sortBy: $sortBy) }');
    });
});