import graphql from 'graphql';
const { isNonNullType, isListType, isScalarType, isEnumType, isInputObjectType, isObjectType } = graphql;
import { z } from 'zod';

// Type for validation options passed from config
export type ValidationOptions = {
    maxOperations?: number;
    maxFields?: number;
    maxOperationArgs?: number;
    maxSchemaDepth?: number;
};

// Memory optimization: Global cache for type schemas to avoid recomputing
const typeSchemaCache = new Map<string, z.ZodTypeAny>();

// Utility function to clear the cache (useful for testing or memory management)
export function clearTypeSchemaCache() {
    typeSchemaCache.clear();
}

// Utility function to get cache size (for monitoring)
export function getTypeSchemaCacheSize() {
    return typeSchemaCache.size;
}

// Helper function to convert GraphQL type to Zod schema
function graphqlTypeToZodSchema(
    type: graphql.GraphQLType,
    schema: graphql.GraphQLSchema,
    visitedTypes: Set<string> = new Set(),
    depth: number = 0,
    options: ValidationOptions = {}
): z.ZodTypeAny {
    const maxSchemaDepth = options.maxSchemaDepth || 10;
    const maxFields = options.maxFields || 100;

    // Prevent excessive depth that can cause memory issues
    if (depth > maxSchemaDepth) {
        return z.any().optional();
    }
    if (isNonNullType(type)) {
        return graphqlTypeToZodSchema(type.ofType, schema, visitedTypes, depth + 1, options);
    }

    if (isListType(type)) {
        const itemSchema = graphqlTypeToZodSchema(type.ofType, schema, visitedTypes, depth + 1, options);
        return z.array(itemSchema);
    }

    if (isScalarType(type)) {
        switch (type.name) {
            case 'String':
                return z.string();
            case 'Int':
                return z.number().int();
            case 'Float':
                return z.number();
            case 'Boolean':
                return z.boolean();
            case 'ID':
                return z.string();
            default:
                return z.string(); // fallback for custom scalars
        }
    }

    if (isEnumType(type)) {
        // Use cache for enum types to avoid recreating them
        const cacheKey = `enum_${type.name}`;
        if (typeSchemaCache.has(cacheKey)) {
            return typeSchemaCache.get(cacheKey)!;
        }

        try {
            // Prevent circular references
            if (visitedTypes.has(type.name)) {
                return z.string(); // fallback for circular enum references
            }

            visitedTypes.add(type.name);

            const values = type.getValues().map(value => value.value);

            // Handle empty enum case
            if (values.length === 0) {
                const schema = z.string();
                typeSchemaCache.set(cacheKey, schema);
                return schema;
            }

            // Handle single value enum case
            if (values.length === 1) {
                const schema = z.literal(values[0]);
                typeSchemaCache.set(cacheKey, schema);
                return schema;
            }

            // Try to create the enum, but fallback if it fails
            try {
                const schema = z.enum(values as [string, ...string[]]);
                typeSchemaCache.set(cacheKey, schema);
                return schema;
            } catch (enumError) {
                console.warn(`Failed to create Zod enum for ${type.name}:`, enumError);
                const literals = values.map(v => z.literal(v));
                if (literals.length === 1) {
                    const schema = literals[0];
                    typeSchemaCache.set(cacheKey, schema);
                    return schema;
                }
                const schema = z.union([literals[0], literals[1], ...literals.slice(2)] as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
                typeSchemaCache.set(cacheKey, schema);
                return schema;
            }
        } catch (error) {
            console.warn(`Error processing enum ${type.name}:`, error);
            const fallbackSchema = z.string();
            typeSchemaCache.set(cacheKey, fallbackSchema);
            return fallbackSchema;
        } finally {
            visitedTypes.delete(type.name);
        }
    }

    if (isInputObjectType(type)) {
        // Use cache for input object types
        const cacheKey = `input_${type.name}`;
        if (typeSchemaCache.has(cacheKey)) {
            return typeSchemaCache.get(cacheKey)!;
        }

        // Prevent circular references
        if (visitedTypes.has(type.name)) {
            return z.object({}).optional(); // fallback for circular references
        }

        visitedTypes.add(type.name);

        try {
            const fields = type.getFields();
            const zodObject: Record<string, z.ZodTypeAny> = {};

            // Limit the number of fields processed to prevent memory exhaustion
            const fieldEntries = Object.entries(fields);

            for (const [fieldName, field] of fieldEntries.slice(0, maxFields)) {
                let fieldSchema = graphqlTypeToZodSchema(field.type, schema, visitedTypes, depth + 1, options);

                // Make field optional if it's nullable
                if (!isNonNullType(field.type)) {
                    fieldSchema = fieldSchema.optional();
                }

                zodObject[fieldName] = fieldSchema;
            }

            // If we had to truncate fields, log a warning
            if (fieldEntries.length > maxFields) {
                console.warn(`Input type ${type.name} has ${fieldEntries.length} fields, truncated to ${maxFields} for memory optimization`);
            }

            const zodSchema = z.object(zodObject);
            typeSchemaCache.set(cacheKey, zodSchema);
            return zodSchema;
        } catch (error) {
            console.warn(`Error processing input object ${type.name}:`, error);
            const fallbackSchema = z.object({}).optional();
            typeSchemaCache.set(cacheKey, fallbackSchema);
            return fallbackSchema;
        } finally {
            visitedTypes.delete(type.name);
        }
    }

    // Fallback for other types
    return z.any();
}

// Generate Zod validation schemas for all operations
export function generateValidationSchemas(operations: any[], schema: graphql.GraphQLSchema, options: ValidationOptions = {}) {
    const validationSchemas: Record<string, z.ZodSchema> = {};
    const maxOperations = options.maxOperations || 200; // Limit operations to prevent memory exhaustion
    const maxArgs = options.maxOperationArgs || 50;

    // Process operations in batches to manage memory
    const operationsToProcess = operations.slice(0, maxOperations);

    if (operations.length > maxOperations) {
        console.warn(`Schema has ${operations.length} operations, processing only ${maxOperations} for memory optimization`);
    }

    for (const operation of operationsToProcess) {
        if (operation.args && operation.args.length > 0) {
            const zodObject: Record<string, z.ZodTypeAny> = {};

            // Limit arguments processed per operation
            const argsToProcess = operation.args.slice(0, maxArgs);

            if (operation.args.length > maxArgs) {
                console.warn(`Operation ${operation.name} has ${operation.args.length} arguments, processing only ${maxArgs} for memory optimization`);
            }

            for (const arg of argsToProcess) {
                let argSchema = graphqlTypeToZodSchema(arg.type, schema, new Set(), 0, options);

                // Make argument optional if it's nullable
                if (!isNonNullType(arg.type)) {
                    argSchema = argSchema.optional();
                }

                zodObject[arg.name] = argSchema;
            }

            validationSchemas[operation.name] = z.object(zodObject);
        } else {
            // For operations with no arguments, create an empty object schema
            validationSchemas[operation.name] = z.object({});
        }
    }

    return validationSchemas;
}

// Helper function to convert GraphQL output type to Zod selection schema
// This creates a schema that validates field selection objects for GraphQL queries/mutations
//
// For a GraphQL type like:
//   type User {
//     id: ID!
//     username: String!
//     email: String!
//     posts: [Post!]!
//   }
//
// This generates a Zod schema that validates objects like:
//   {
//     id: true,        // boolean to indicate field should be included
//     username: true,  // boolean to indicate field should be included
//     email: false,    // boolean to indicate field should be excluded (optional)
//     posts: {         // nested object for complex types
//       id: true,
//       title: true
//     }
//   }
//
// All fields are optional because you might not want to select all available fields
function graphqlOutputTypeToZodSelectionSchema(
    type: graphql.GraphQLType,
    schema: graphql.GraphQLSchema,
    visitedTypes: Set<string> = new Set(),
    depth: number = 0,
    options: ValidationOptions = {}
): z.ZodTypeAny {
    const maxSchemaDepth = options.maxSchemaDepth || 10;
    const maxFields = options.maxFields || 50; // Use a lower limit for output selection

    // Prevent excessive depth that can cause memory issues
    if (depth > maxSchemaDepth) {
        return z.boolean().optional();
    }

    if (isNonNullType(type)) {
        return graphqlOutputTypeToZodSelectionSchema(type.ofType, schema, visitedTypes, depth + 1, options);
    }

    if (isListType(type)) {
        const itemSchema = graphqlOutputTypeToZodSelectionSchema(type.ofType, schema, visitedTypes, depth + 1, options);
        return itemSchema; // For selection schemas, we don't need to wrap in array
    }

    if (isScalarType(type) || isEnumType(type)) {
        // For scalars and enums, the selection schema is just a boolean
        return z.boolean().optional();
    }

    if (isObjectType(type)) {
        // Use cache for output object types
        const cacheKey = `output_${type.name}_${depth}`;
        if (typeSchemaCache.has(cacheKey)) {
            return typeSchemaCache.get(cacheKey)!;
        }

        // Prevent infinite recursion for circular references
        if (visitedTypes.has(type.name)) {
            return z.object({}).optional();
        }

        visitedTypes.add(type.name);

        const fields = type.getFields();
        const zodObject: Record<string, z.ZodTypeAny> = {};

        // Limit fields processed to prevent memory exhaustion
        const fieldEntries = Object.entries(fields);

        for (const [fieldName, field] of fieldEntries.slice(0, maxFields)) {
            const fieldSelectionSchema = graphqlOutputTypeToZodSelectionSchema(
                field.type,
                schema,
                new Set(visitedTypes), // Create a copy to avoid mutation issues
                depth + 1,
                options
            );
            zodObject[fieldName] = fieldSelectionSchema;
        }

        if (fieldEntries.length > maxFields) {
            console.warn(`Output type ${type.name} has ${fieldEntries.length} fields, truncated to ${maxFields} for memory optimization`);
        }

        visitedTypes.delete(type.name);
        const resultSchema = z.object(zodObject).strict().optional();
        typeSchemaCache.set(cacheKey, resultSchema);
        return resultSchema;
    }

    // Fallback for other types
    return z.boolean().optional();
}

// Helper function to create default selection for first-layer scalar/enum fields
function createDefaultSelection(
    type: graphql.GraphQLType
): Record<string, boolean> {
    const defaultSelection: Record<string, boolean> = {};

    // Unwrap NonNull and List types to get to the core type
    let coreType = type;
    if (isNonNullType(coreType)) {
        coreType = coreType.ofType;
    }
    if (isListType(coreType)) {
        coreType = coreType.ofType;
        if (isNonNullType(coreType)) {
            coreType = coreType.ofType;
        }
    }

    if (isObjectType(coreType)) {
        const fields = coreType.getFields();

        for (const [fieldName, field] of Object.entries(fields)) {
            // Skip fields that have required arguments
            const hasRequiredArgs = field.args.some(arg => isNonNullType(arg.type));
            if (hasRequiredArgs) {
                continue; // Skip this field as it cannot be included in default selection
            }

            let fieldType = field.type;

            // Unwrap NonNull types
            if (isNonNullType(fieldType)) {
                fieldType = fieldType.ofType;
            }

            // Only set default true for scalar and enum types (first layer only)
            if (isScalarType(fieldType) || isEnumType(fieldType)) {
                defaultSelection[fieldName] = true;
            }
            // For List types, check if the item type is scalar/enum
            else if (isListType(fieldType)) {
                let itemType = fieldType.ofType;
                if (isNonNullType(itemType)) {
                    itemType = itemType.ofType;
                }
                if (isScalarType(itemType) || isEnumType(itemType)) {
                    defaultSelection[fieldName] = true;
                }
            }
        }
    }

    return defaultSelection;
}

// Generate Zod output selection schemas for all operations
export function generateOutputSelectionSchemas(operations: any[], schema: graphql.GraphQLSchema, options: ValidationOptions = {}) {
    const outputSchemas: Record<string, z.ZodSchema> = {};
    const maxOperations = options.maxOperations || 200;

    // Process operations in batches to manage memory
    const operationsToProcess = operations.slice(0, maxOperations);

    if (operations.length > maxOperations) {
        console.warn(`Schema has ${operations.length} operations, processing only ${maxOperations} output schemas for memory optimization`);
    }

    for (const operation of operationsToProcess) {
        try {
            const returnType = operation.field.type;
            const selectionSchema = graphqlOutputTypeToZodSelectionSchema(returnType, schema, new Set(), 0, options);

            // Create default selection for first-layer scalar/enum fields that have no arguments
            const defaultSelection = createDefaultSelection(returnType);

            // Transform the schema to apply defaults when selection is empty or undefined
            const schemaWithDefaults = selectionSchema.transform((value) => {
                // If value is undefined, null, or empty object, use defaults
                if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
                    return defaultSelection;
                }
                return value;
            });

            outputSchemas[operation.name] = schemaWithDefaults;
        } catch (error) {
            console.warn(`Error generating output schema for ${operation.name}:`, error);
            // Provide a fallback schema
            outputSchemas[operation.name] = z.object({}).optional();
        }
    }

    return outputSchemas;
}

// Standalone validation function for output selection
export function validateOutputSelection(
    operationName: string,
    selection: any,
    outputSchemas: Record<string, z.ZodSchema>
) {
    const outputSchema = outputSchemas[operationName];

    if (!outputSchema) {
        throw new Error(`No output schema found for operation: ${operationName}`);
    }

    try {
        return outputSchema.parse(selection);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
        throw new Error(`Output selection validation failed for ${operationName}: ${errorMessage}`);
    }
}

// Standalone validation function for operation arguments
export function validateOperationArguments(
    operationName: string,
    variables: any,
    validationSchemas: Record<string, z.ZodSchema>
) {
    const validationSchema = validationSchemas[operationName];

    if (!validationSchema) {
        throw new Error(`No validation schema found for operation: ${operationName}`);
    }

    try {
        return validationSchema.parse(variables);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
        throw new Error(`Validation failed for ${operationName}: ${errorMessage}`);
    }
}