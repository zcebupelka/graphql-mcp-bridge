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
    inputSchema: any;
    outputSchema: any;
};

export type Config = {
    /**
     * if `true` it generates functions for mutations as well.
     */
    mutation?: boolean
    /**
     * if `true` it generates functions for subscriptions as well.
     * Default: false
     * Note: Subscriptions are not yet fully supported in this version.
     * You can generate the functions, but you need to handle the subscription logic (e.g., using WebSockets) yourself.
    */
    subscription?: boolean
    /**
     * if `true` it generates functions for queries as well.
     * Default: true
     */
    query?: boolean
    /**
     * adds a phrase to name of your query functions.
     * For example you have this query: `getUser` and the prefix is `QUERY_`, name of the function would be `QUERY_getUser`
     * Default: empty string
     */
    queryPrefix?: string
    /**
     * adds a phrase to name of your mutation functions.
     * For example you have this mutation: `createUser` and the prefix is `MUTATION_`, name of the function would be `MUTATION_createUser`
     * Default: empty string
     */
    mutationPrefix?: string
    /**
     * adds a phrase to name of your subscription functions.
     * For example you have this subscription: `onUserCreated` and the prefix is `SUBSCRIPTION_`, name of the function would be `SUBSCRIPTION_onUserCreated`
     * Default: empty string
     */
    subscriptionPrefix?: string
    /**
     * If a query or mutation has this phrase in its description, it will be ignored and no tool will be generated for it.
     * default: 'NO_MPC_TOOL'
     */
    ignorePhrase?: string
    /**
     * Maximum number of operations to process to prevent memory exhaustion.
     * Default: 200
     */
    maxOperations?: number
    /**
     * Maximum number of arguments per operation to process.
     * Default: 50
     */
    maxOperationArgs?: number
    /**
     * Maximum schema processing depth to prevent stack overflow.
     * Default: 10
     */
    maxSchemaDepth?: number
    /**
     * Maximum number of fields per type to process.
     * Default: 100
     */
    maxFields?: number
};

const defaultConfig = {
    mutation: false,
    subscription: false,
    query: true,
    queryPrefix: '',
    mutationPrefix: '',
    subscriptionPrefix: '',
    ignorePhrase: 'NO_MPC_TOOL',
    maxOperations: 200,
    maxOperationArgs: 50,
    maxSchemaDepth: 10,
    maxFields: 100
}

export async function schemaParser(graphqlSchema: string, config: Config = defaultConfig): Promise<Tool[]> {
    // Parse the schema
    const schema: graphql.GraphQLSchema = graphql.buildSchema(graphqlSchema);
    const operations = extractOperationsFromSchema(schema, config);

    // Apply memory optimization limits
    const validationOptions = {
        maxOperations: config.maxOperations || 200,
        maxFields: config.maxFields || 100,
        maxOperationArgs: config.maxOperationArgs || 50,
        maxSchemaDepth: config.maxSchemaDepth || 10
    };

    const validationSchemas = generateValidationSchemas(operations, schema, validationOptions);
    const outputSelectionSchemas = generateOutputSelectionSchemas(operations, schema, validationOptions);

    // Generate tools array with memory optimization
    const tools: Tool[] = [];
    const maxTools = config.maxOperations || 200;

    for (let i = 0; i < Math.min(operations.length, maxTools); i++) {
        const operation = operations[i];

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

                return { query, variables };
            },
            description: operation.description || `GraphQL ${operation.type} operation: ${operation.name}`,
            inputSchema: validationSchemas[operation.name] || z.object({}),
            outputSchema: outputSelectionSchemas[operation.name]
        };

        tools.push(tool);
    }

    return tools;
}

export function extractOperationsFromSchema(schema: graphql.GraphQLSchema, config: Config) {
    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();
    const subscriptionType = schema.getSubscriptionType();

    const operations: {
        type: 'query' | 'mutation' | 'subscription';
        name: string;
        field: graphql.GraphQLField<any, any>;
        args: {
            name: string;
            type: graphql.GraphQLType;
        }[];
        description: string;
    }[] = [];
    const operationsSet = new Set<string>();

    // Helper function to convert GraphQL field args to our OperationArg format
    const transformArgs = (fieldArgs: readonly graphql.GraphQLArgument[]) => {
        return fieldArgs.map(arg => ({
            name: arg.name,
            type: arg.type // Keep the actual GraphQL type object for validation
        }));
    };

    // Extract queries
    if (queryType && config.query != false) {
        const fields = queryType.getFields();
        const queryPrefix = config.queryPrefix || '';
        for (const [fieldName, field] of Object.entries(fields)) {
            if (field.description && config.ignorePhrase && field.description.includes(config.ignorePhrase)) {
                continue; // Skip fields with the ignore phrase in their description
            };
            const uniqueName = `query-${fieldName}`;
            if (operationsSet.has(uniqueName)) {
                continue; // Skip duplicate operation names
            }
            operationsSet.add(uniqueName);
            operations.push({
                type: 'query',
                name: `${queryPrefix}${fieldName}`,
                field: field,
                args: transformArgs(field.args),
                description: field.description || ''
            });
        }
    }

    // Extract mutations
    if (mutationType && config.mutation == true) {
        const fields = mutationType.getFields();
        for (const [fieldName, field] of Object.entries(fields)) {
            if (field.description && config.ignorePhrase && field.description.includes(config.ignorePhrase)) {
                continue; // Skip fields with the ignore phrase in their description
            };
            const mutationPrefix = config.mutationPrefix || '';
            const uniqueName = `mutation-${fieldName}`;
            if (operationsSet.has(uniqueName)) {
                continue; // Skip duplicate operation names
            }
            operationsSet.add(uniqueName);
            operations.push({
                type: 'mutation',
                name: `${mutationPrefix}${fieldName}`,
                field: field,
                args: transformArgs(field.args),
                description: field.description || ''
            });
        }
    }

    // Extract subscriptions
    if (subscriptionType && config.subscription == true) {
        const fields = subscriptionType.getFields();
        for (const [fieldName, field] of Object.entries(fields)) {
            if (field.description && config.ignorePhrase && field.description.includes(config.ignorePhrase)) {
                continue; // Skip fields with the ignore phrase in their description
            };
            const uniqueName = `subscription-${fieldName}`;
            const subscriptionPrefix = config.subscriptionPrefix || '';
            if (operationsSet.has(uniqueName)) {
                continue; // Skip duplicate operation names
            }
            operationsSet.add(uniqueName);
            operations.push({
                type: 'subscription',
                name: `${subscriptionPrefix}${fieldName}`,
                field: field,
                args: transformArgs(field.args),
                description: field.description || ''
            });
        }
    }

    return operations;
}

// Re-export validation functions for convenience
export { validateOperationArguments, validateOutputSelection };