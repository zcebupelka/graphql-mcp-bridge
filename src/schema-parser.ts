// import { buildSchema, GraphQLSchema, parse, validate, execute, isNonNullType, isListType, isScalarType, isEnumType, isInputObjectType, GraphQLInputObjectType, GraphQLEnumType, GraphQLScalarType, GraphQLType } from 'graphql';
import graphql from 'graphql';
import { z } from 'zod';
import { generateValidationSchemas, generateOutputSelectionSchemas, validateOperationArguments, validateOutputSelection } from './generate-validation.ts';
import { generateQueryString } from './generate-query-string.ts';

export type Tool = {
    name: string;
    execution: (variables: any) => Promise<{
        query: string;
        variables: any;
    }>;
    description?: string;
    inputSchema?: z.ZodTypeAny;
    outputSchema?: z.ZodTypeAny;
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
            execution: async (variables: any = {}) => {
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
            inputSchema: validationSchemas[operation.name],
            outputSchema: outputSelectionSchemas[operation.name]
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

    // Helper function to convert GraphQL field args to our OperationArg format
    const transformArgs = (fieldArgs: readonly graphql.GraphQLArgument[]) => {
        return fieldArgs.map(arg => ({
            name: arg.name,
            type: arg.type.toString() // Convert GraphQL type to string representation
        }));
    };

    // Extract queries
    if (queryType) {
        const fields = queryType.getFields();
        for (const [fieldName, field] of Object.entries(fields)) {
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