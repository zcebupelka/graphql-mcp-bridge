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
                    message: 'Invalid type for variable b: expected number, received undefined'
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

    describe("Schema 5 - enums", () => {
        const schema = `
        enum Role {
            ADMIN
            USER
            GUEST
        }

        type User {
            id: ID!
            username: String!
            role: Role!
        }

        type Query {
            getUsersByRole(role: Role!): [User!]
        }
        `;

        test("should parse schema 5 correctly", async () => {
            const tools = await schemaParser(schema);
            assert.ok(tools);
            assert.ok(Array.isArray(tools));
            assert.strictEqual(tools.length, 1);

            const getUsersByRoleTool = tools.find(tool => tool.name === "getUsersByRole");
            assert.ok(getUsersByRoleTool);
            const result = await getUsersByRoleTool.execution({ role: "ADMIN" }, { id: true, username: true, role: true });
            assert.strictEqual(
                result.query.trim(),
                "query getUsersByRole($role: Role!) { getUsersByRole(role: $role) { id username role } }"
            );
        });
    });

    describe("Schema 6 - nested selections", () => {
        const schema = `
        type Comment {
            id: ID!
            content: String!
        }

        type Post {
            id: ID!
            title: String!
            comments: [Comment!]!
        }

        type User {
            id: ID!
            username: String!
            posts: [Post!]!
        }

        type Query {
            getUser(id: ID!): User
        }
        `;

        test("should parse schema 6 correctly", async () => {
            const tools = await schemaParser(schema);
            assert.ok(tools);
            assert.ok(Array.isArray(tools));
            assert.strictEqual(tools.length, 1);

            const getUserTool = tools.find(tool => tool.name === "getUser");
            assert.ok(getUserTool);
            const result = await getUserTool.execution({ id: "123" }, { id: true, username: true, posts: { title: true, comments: { content: true } } });
            assert.strictEqual(
                result.query.trim(),
                "query getUser($id: ID!) { getUser(id: $id) { id username posts { title comments { content } } } }"
            );
        });
    });

    describe("Schema 7 Interface and Union types", () => {
        const schema = `
        interface Animal {
            id: ID!
            name: String!
        }

        type Dog implements Animal {
            id: ID!
            name: String!
            breed: String!
        }

        type Cat implements Animal {
            id: ID!
            name: String!
            color: String!
        }

        union Pet = Dog | Cat

        type Query {
            getPet(id: ID!): Pet
            getAnimal(id: ID!): Animal
            getAllPets: [Pet!]!
        }
        `;

        test("should parse union types correctly", async () => {
            const tools = await schemaParser(schema);
            assert.ok(tools);
            assert.ok(Array.isArray(tools));
            assert.strictEqual(tools.length, 3);

            const getPetTool = tools.find(tool => tool.name === "getPet");
            assert.ok(getPetTool);
            const result = await getPetTool.execution({ id: "123" }, { __typename: true, Dog: { id: true, name: true, breed: true }, Cat: { id: true, name: true, color: true } });
            assert.strictEqual(
                result.query.trim(),
                "query getPet($id: ID!) { getPet(id: $id) { __typename ... on Dog { id name breed } ... on Cat { id name color } } }"
            );
        });

        test("should parse interface types correctly", async () => {
            const tools = await schemaParser(schema);
            const getAnimalTool = tools.find(tool => tool.name === "getAnimal");
            assert.ok(getAnimalTool);
            const result = await getAnimalTool.execution({ id: "456" }, { id: true, name: true, Dog: { breed: true }, Cat: { color: true } });
            assert.strictEqual(
                result.query.trim(),
                "query getAnimal($id: ID!) { getAnimal(id: $id) { id name ... on Dog { breed } ... on Cat { color } } }"
            );
        });

        test("should handle union types in lists", async () => {
            const tools = await schemaParser(schema);
            const getAllPetsTool = tools.find(tool => tool.name === "getAllPets");
            assert.ok(getAllPetsTool);
            const result = await getAllPetsTool.execution({}, { __typename: true, Dog: { id: true, breed: true }, Cat: { id: true, color: true } });
            assert.strictEqual(
                result.query.trim(),
                "query getAllPets { getAllPets { __typename ... on Dog { id breed } ... on Cat { id color } } }"
            );
        });

        test("should handle partial selection on union types", async () => {
            const tools = await schemaParser(schema);
            const getPetTool = tools.find(tool => tool.name === "getPet");
            assert.ok(getPetTool);
            const result = await getPetTool.execution({ id: "123" }, { Dog: { name: true, breed: true } });
            assert.strictEqual(
                result.query.trim(),
                "query getPet($id: ID!) { getPet(id: $id) { ... on Dog { name breed } } }"
            );
        });

        test("should handle mixed common and specific fields", async () => {
            const tools = await schemaParser(schema);
            const getAnimalTool = tools.find(tool => tool.name === "getAnimal");
            assert.ok(getAnimalTool);
            const result = await getAnimalTool.execution({ id: "789" }, {
                id: true,
                name: true,
                __typename: true,
                Dog: { breed: true },
                Cat: { color: true }
            });
            assert.strictEqual(
                result.query.trim(),
                "query getAnimal($id: ID!) { getAnimal(id: $id) { id name __typename ... on Dog { breed } ... on Cat { color } } }"
            );
        });
    });

    describe("Schema 8 - Complex interfaces with multiple implementations", () => {
        const schema = `
        interface Node {
            id: ID!
        }

        interface Content {
            title: String!
            createdAt: String!
        }

        type Article implements Node & Content {
            id: ID!
            title: String!
            createdAt: String!
            body: String!
            authorId: ID!
        }

        type Video implements Node & Content {
            id: ID!
            title: String!
            createdAt: String!
            duration: Int!
            url: String!
        }

        type Audio implements Node {
            id: ID!
            filename: String!
            size: Int!
        }

        union SearchResult = Article | Video | Audio

        type Query {
            search(query: String!): [SearchResult!]!
            getNode(id: ID!): Node
            getContent(id: ID!): Content
        }
        `;

        test("should handle multiple interface implementations", async () => {
            const tools = await schemaParser(schema);
            const searchTool = tools.find(tool => tool.name === "search");
            assert.ok(searchTool);

            const result = await searchTool.execution({ query: "test" }, {
                __typename: true,
                Article: { id: true, title: true, body: true },
                Video: { id: true, title: true, url: true },
                Audio: { id: true, filename: true }
            });

            assert.strictEqual(
                result.query.trim(),
                "query search($query: String!) { search(query: $query) { __typename ... on Article { id title body } ... on Video { id title url } ... on Audio { id filename } } }"
            );
        });

        test("should handle interface queries", async () => {
            const tools = await schemaParser(schema);
            const getNodeTool = tools.find(tool => tool.name === "getNode");
            assert.ok(getNodeTool);

            const result = await getNodeTool.execution({ id: "node1" }, {
                id: true,
                Article: { title: true, body: true },
                Video: { title: true, duration: true },
                Audio: { filename: true }
            });

            assert.strictEqual(
                result.query.trim(),
                "query getNode($id: ID!) { getNode(id: $id) { id ... on Article { title body } ... on Video { title duration } ... on Audio { filename } } }"
            );
        });
    });
})