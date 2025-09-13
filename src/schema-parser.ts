// import { buildSchema, GraphQLSchema, parse, validate, execute, isNonNullType, isListType, isScalarType, isEnumType, isInputObjectType, GraphQLInputObjectType, GraphQLEnumType, GraphQLScalarType, GraphQLType } from 'graphql';
import graphql from 'graphql';
import { z } from 'zod';
import { generateValidationSchemas, generateOutputSelectionSchemas, validateOperationArguments, validateOutputSelection } from './generate-validation.ts';
import { generateQueryString } from './generate-query-string.ts';

export type Tool = {
    name: string;
    execution: (variables: any, selectedFields: any) => Promise<{
        query: string;
        variables: any;
    }>;
    description: string;
    inputSchema: z.ZodType<any, any, any>;
    outputSchema: z.ZodType<any, any, any>;
};

export async function schemaParser(graphqlSchema: string): Promise<Tool[]> {
    // Parse the schema
    const schema: graphql.GraphQLSchema = graphql.buildSchema(graphqlSchema);
    const operations = extractOperationsFromSchema(schema);
    const validationSchemas = generateValidationSchemas(operations, schema);
    const outputSelectionSchemas = generateOutputSelectionSchemas(operations, schema);

    // Generate tools array
    const tools: Tool[] = [];

    for (const operation of operations) {
        const tool: Tool = {
            name: operation.name,
            execution: async (variables: any = {}, selectedFields: any = {}) => {
                // Validate input variables using Zod schema
                const validationSchema = validationSchemas[operation.name];
                if (validationSchema) {
                    try {
                        const validatedVariables = validationSchema.parse(variables);
                        variables = validatedVariables;
                    } catch (error) {
                        // Parse Zod error to provide more user-friendly error messages
                        if (error && typeof error === 'object' && 'issues' in error) {
                            const zodError = error as any;
                            const issues = zodError.issues || [];

                            // Check for missing required fields first
                            for (const issue of issues) {
                                if (issue.code === 'invalid_type' && issue.received === 'undefined') {
                                    const fieldName = issue.path[0];
                                    throw new Error(`Missing required variable: ${fieldName}`);
                                }
                            }

                            // Check for invalid types (but not missing fields)
                            for (const issue of issues) {
                                if (issue.code === 'invalid_type' && issue.received !== 'undefined') {
                                    const fieldName = issue.path[0];
                                    const expected = issue.expected;
                                    const received = issue.received;
                                    throw new Error(`Invalid type for variable ${fieldName}: expected ${expected}, received ${received}`);
                                }
                            }
                        }

                        const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
                        throw new Error(`Validation failed for ${operation.name}: ${errorMessage}`);
                    }
                }

                const query = generateQueryString(operation, variables, selectedFields);

                // const response = await fetch(endpoint, {
                //     method: 'POST',
                //     headers: {
                //         'Content-Type': 'application/json',
                //     },
                //     body: JSON.stringify({
                //         query,
                //         variables
                //     })
                // });

                return { query, variables };
            },
            description: `GraphQL ${operation.type} operation: ${operation.name}`,
            inputSchema: validationSchemas[operation.name] || z.object({}),
            outputSchema: outputSelectionSchemas[operation.name] || z.object({})
        };

        tools.push(tool);
    }

    return tools;
}

function extractOperationsFromSchema(schema: graphql.GraphQLSchema) {
    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();
    const subscriptionType = schema.getSubscriptionType();

    const operations: any[] = [];
    const operationsSet = new Set<string>();

    // Helper function to convert GraphQL field args to our OperationArg format
    const transformArgs = (fieldArgs: readonly graphql.GraphQLArgument[]) => {
        return fieldArgs.map(arg => ({
            name: arg.name,
            type: arg.type // Keep the actual GraphQL type object for validation
        }));
    };

    // Extract queries
    if (queryType) {
        const fields = queryType.getFields();
        for (const [fieldName, field] of Object.entries(fields)) {
            const uniqueName = `query-${fieldName}`;
            if (operationsSet.has(uniqueName)) {
                continue; // Skip duplicate operation names
            }
            operationsSet.add(uniqueName);
            operations.push({
                type: 'query',
                name: fieldName,
                field: field,
                args: transformArgs(field.args)
            });
        }
    }

    // Extract mutations
    if (mutationType) {
        const fields = mutationType.getFields();
        for (const [fieldName, field] of Object.entries(fields)) {
            const uniqueName = `mutation-${fieldName}`;
            if (operationsSet.has(uniqueName)) {
                continue; // Skip duplicate operation names
            }
            operationsSet.add(uniqueName);
            operations.push({
                type: 'mutation',
                name: fieldName,
                field: field,
                args: transformArgs(field.args)
            });
        }
    }

    // Extract subscriptions
    if (subscriptionType) {
        const fields = subscriptionType.getFields();
        for (const [fieldName, field] of Object.entries(fields)) {
            const uniqueName = `subscription-${fieldName}`;
            if (operationsSet.has(uniqueName)) {
                continue; // Skip duplicate operation names
            }
            operationsSet.add(uniqueName);
            operations.push({
                type: 'subscription',
                name: fieldName,
                field: field,
                args: transformArgs(field.args)
            });
        }
    }

    return operations;
}

// Generate executable functions for each operation with validation
// @deprecated Use schemaParser instead, which returns Tool[] with embedded functions
export function generateOperationFunctions(
    operations: any[],
    endpoint: string,
    validationSchemas: Record<string, z.ZodSchema>
) {
    const functions: Record<string, Function> = {};

    for (const operation of operations) {
        functions[operation.name] = async (variables: any = {}) => {
            // Validate input variables using Zod schema
            const validationSchema = validationSchemas[operation.name];
            if (validationSchema) {
                try {
                    const validatedVariables = validationSchema.parse(variables);
                    variables = validatedVariables;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
                    throw new Error(`Validation failed for ${operation.name}: ${errorMessage}`);
                }
            }

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

// Re-export validation functions for convenience
export { validateOperationArguments, validateOutputSelection };