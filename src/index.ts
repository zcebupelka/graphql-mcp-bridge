import { buildSchema, GraphQLSchema, parse, validate, execute } from 'graphql';
import z from 'zod';

export async function schemaParser(graphqlSchema: string) {
    // Parse the schema
    const schema: GraphQLSchema = buildSchema(graphqlSchema);
    const operations = extractOperationsFromSchema(schema);

    return {
        operations
    };
}

function extractOperationsFromSchema(schema: GraphQLSchema) {
    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();
    const subscriptionType = schema.getSubscriptionType();

    const operations: any[] = [];

    // Extract queries
    if (queryType) {
        const fields = queryType.getFields();
        for (const [fieldName, field] of Object.entries(fields)) {
            operations.push({
                type: 'query',
                name: fieldName,
                field: field,
                args: field.args
            });
        }
    }

    // Extract mutations
    if (mutationType) {
        const fields = mutationType.getFields();
        for (const [fieldName, field] of Object.entries(fields)) {
            operations.push({
                type: 'mutation',
                name: fieldName,
                field: field,
                args: field.args
            });
        }
    }

    // Extract subscriptions
    if (subscriptionType) {
        const fields = subscriptionType.getFields();
        for (const [fieldName, field] of Object.entries(fields)) {
            operations.push({
                type: 'subscription',
                name: fieldName,
                field: field,
                args: field.args
            });
        }
    }

    return operations;
}

// Generate executable functions for each operation
export function generateOperationFunctions(operations: any[], endpoint: string) {
    const functions: Record<string, Function> = {};

    for (const operation of operations) {
        functions[operation.name] = async (variables: any = {}) => {
            const query = generateQueryString(operation, variables);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables
                })
            });

            return response.json();
        };
    }

    return functions;
}

function generateQueryString(operation: any, variables: any) {
    const args = operation.args.map((arg: any) => `$${arg.name}: ${arg.type}`).join(', ');
    const fieldArgs = operation.args.map((arg: any) => `${arg.name}: $${arg.name}`).join(', ');

    if (operation.type === 'query') {
        return `query ${operation.name}(${args}) { ${operation.name}(${fieldArgs}) }`;
    } else if (operation.type === 'mutation') {
        return `mutation ${operation.name}(${args}) { ${operation.name}(${fieldArgs}) }`;
    } else if (operation.type === 'subscription') {
        return `subscription ${operation.name}(${args}) { ${operation.name}(${fieldArgs}) }`;
    }
}