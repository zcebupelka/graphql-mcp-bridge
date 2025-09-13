import { describe, test } from "node:test";
import assert from "node:assert";
import { schemaParser } from "../schema-parser.ts";

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
            const result = await tools[0].execution({}, {});
            assert.strictEqual(result.query.trim(), "query hello { hello }");
        });

        test("should handle missing variables gracefully", async () => {
            const tools = await schemaParser(schema);
            const result = await tools[0].execution({}, {});
            assert.strictEqual(result.query.trim(), "query hello { hello }");
        });
    });

    describe("Schema 2", () => {
        const schema = `
        type Query {
            greet(name: String!): String
        }
        `;

        test("should parse schema 2 correctly", async () => {
            const tools = await schemaParser(schema);
            assert.ok(tools);
            assert.ok(Array.isArray(tools));
            assert.strictEqual(tools.length, 1);
            assert.strictEqual(tools[0].name, "greet");
            const result = await tools[0].execution({ name: "World" }, {});
            assert.strictEqual(result.query.trim(), "query greet($name: String!) { greet(name: $name) }");
        });
    });

    describe("Schema 3", () => {
        const schema = `
        type Mutation {
            add(a: Int!, b: Int!): Int
        }
        `;

        test("should parse schema 3 correctly", async () => {
            const tools = await schemaParser(schema);
            assert.ok(tools);
            assert.ok(Array.isArray(tools));
            assert.strictEqual(tools.length, 1);
            assert.strictEqual(tools[0].name, "add");
            const result = await tools[0].execution({ a: 5, b: 10 }, {});
            assert.strictEqual(result.query.trim(), "mutation add($a: Int!, $b: Int!) { add(a: $a, b: $b) }");
        });

        test("should throw error for missing required variables", async () => {
            const tools = await schemaParser(schema);
            await assert.rejects(
                async () => {
                    await tools[0].execution({ a: 5 }, {});
                },
                {
                    message: /Missing required variable: b/
                }
            );
        });
    });

    describe("Schema 4 - more complicated including selecting fields", () => {
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
        }

        type Query {
            user(id: ID!): User
        }

        type Mutation {
            createUser(input: CreateUserInput!): User
        }
        input CreateUserInput {
            username: String!
            email: String!
        }
        `;

        test("should parse schema 4 correctly", async () => {
            const tools = await schemaParser(schema);
            assert.ok(tools);
            assert.ok(Array.isArray(tools));
            assert.strictEqual(tools.length, 2);

            const userTool = tools.find(tool => tool.name === "user");
            assert.ok(userTool);
            const userResult = await userTool.execution({ id: "123" }, { id: true, username: true, posts: { title: true } });
            assert.strictEqual(
                userResult.query.trim(),
                "query user($id: ID!) { user(id: $id) { id username posts { title } } }"
            );
            // another selection
            const userResult2 = await userTool.execution({ id: "123" }, { id: true, email: true });
            assert.strictEqual(
                userResult2.query.trim(),
                "query user($id: ID!) { user(id: $id) { id email } }"
            );

            const createUserTool = tools.find(tool => tool.name === "createUser");
            assert.ok(createUserTool);
            const createUserResult = await createUserTool.execution({ input: { username: "john_doe", email: "test@gmail.com" } }, { id: true, username: true });
            assert.strictEqual(
                createUserResult.query.trim(),
                "mutation createUser($input: CreateUserInput!) { createUser(input: $input) { id username } }"
            );

            // another selection
            const createUserResult2 = await createUserTool.execution({ input: { username: "john_doe", email: "x@gmail.com" } }, { id: true });

            assert.strictEqual(
                createUserResult2.query.trim(),
                "mutation createUser($input: CreateUserInput!) { createUser(input: $input) { id } }"
            );
        });

    });

})