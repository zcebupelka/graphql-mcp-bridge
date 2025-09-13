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
});