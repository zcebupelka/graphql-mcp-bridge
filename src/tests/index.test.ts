import { describe, test } from 'node:test';
import { greeting } from '../index.ts';
import assert from 'node:assert';
describe('Sample Test Suite', () => {
    test('Sample Test Case', () => {
        const result = greeting('World');
        assert.strictEqual(result, 'Hello, World!');

    });
});