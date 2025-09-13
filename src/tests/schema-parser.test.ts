import { describe, test } from "node:test";
import assert from "node:assert";
import { schemaParser } from "../schema-parser";

describe("Testing Different Schemas", () => {
    describe("Schema 1", () => {
        const schema = `
        type Query {
            hello: String
        }
        `;

        test("should parse schema 1 correctly", async () => {
            const tools = await schemaParser(schema);
            assert.ok(tools);
            assert.ok(Array.isArray(tools));
            assert.strictEqual(tools.length, 1);
            assert.strictEqual(tools[0].name, "hello");
        });

    })
})