import pkg from 'graphql';
const { buildSchema, GraphQLSchema, parse, validate, execute, isNonNullType, isListType, isScalarType, isEnumType, isInputObjectType, isObjectType, GraphQLInputObjectType, GraphQLEnumType, GraphQLScalarType, GraphQLObjectType } = pkg;
import { z } from 'zod';

// Helper function to convert GraphQL type to Zod schema
function graphqlTypeToZodSchema(
    type: pkg.GraphQLType,
    schema: pkg.GraphQLSchema,
    visitedTypes: Set<string> = new Set()
): z.ZodTypeAny {
    if (isNonNullType(type)) {
        return graphqlTypeToZodSchema(type.ofType, schema, visitedTypes);
    }

    if (isListType(type)) {
        const itemSchema = graphqlTypeToZodSchema(type.ofType, schema, visitedTypes);
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
        try {
            // Prevent circular references
            if (visitedTypes.has(type.name)) {
                return z.string(); // fallback for circular enum references
            }

            visitedTypes.add(type.name);

            const values = type.getValues().map(value => value.value);

            // Handle empty enum case
            if (values.length === 0) {
                return z.string();
            }

            // Handle single value enum case
            if (values.length === 1) {
                return z.literal(values[0]);
            }

            // Try to create the enum, but fallback if it fails
            try {
                return z.enum(values as [string, ...string[]]);
            } catch (enumError) {
                console.warn(`Failed to create Zod enum for ${type.name}:`, enumError);
                return z.union(values.map(v => z.literal(v)) as [z.ZodLiteral<string>, ...z.ZodLiteral<string>[]]);
            }
        } catch (error) {
            console.warn(`Error processing enum ${type.name}:`, error);
            return z.string(); // fallback
        } finally {
            visitedTypes.delete(type.name);
        }
    }

    if (isInputObjectType(type)) {
        // Prevent circular references
        if (visitedTypes.has(type.name)) {
            return z.object({}).optional(); // fallback for circular references
        }

        visitedTypes.add(type.name);

        try {
            const fields = type.getFields();
            const zodObject: Record<string, z.ZodTypeAny> = {};

            for (const [fieldName, field] of Object.entries(fields)) {
                let fieldSchema = graphqlTypeToZodSchema(field.type, schema, visitedTypes);

                // Make field optional if it's nullable
                if (!isNonNullType(field.type)) {
                    fieldSchema = fieldSchema.optional();
                }

                zodObject[fieldName] = fieldSchema;
            }

            return z.object(zodObject);
        } catch (error) {
            console.warn(`Error processing input object ${type.name}:`, error);
            return z.object({}).optional(); // fallback
        } finally {
            visitedTypes.delete(type.name);
        }
    }

    // Fallback for other types
    return z.any();
}

// Generate Zod validation schemas for all operations
export function generateValidationSchemas(operations: any[], schema: pkg.GraphQLSchema) {
    const validationSchemas: Record<string, z.ZodSchema> = {};

    for (const operation of operations) {
        if (operation.args && operation.args.length > 0) {
            const zodObject: Record<string, z.ZodTypeAny> = {};

            for (const arg of operation.args) {
                let argSchema = graphqlTypeToZodSchema(arg.type, schema, new Set());

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
    type: pkg.GraphQLType,
    schema: pkg.GraphQLSchema,
    visitedTypes: Set<string> = new Set()
): z.ZodTypeAny {
    if (isNonNullType(type)) {
        return graphqlOutputTypeToZodSelectionSchema(type.ofType, schema, visitedTypes);
    }

    if (isListType(type)) {
        const itemSchema = graphqlOutputTypeToZodSelectionSchema(type.ofType, schema, visitedTypes);
        return itemSchema; // For selection schemas, we don't need to wrap in array
    }

    if (isScalarType(type) || isEnumType(type)) {
        // For scalars and enums, the selection schema is just a boolean
        return z.boolean().optional();
    }

    if (isObjectType(type)) {
        // Prevent infinite recursion for circular references
        if (visitedTypes.has(type.name)) {
            return z.object({}).optional();
        }

        visitedTypes.add(type.name);

        const fields = type.getFields();
        const zodObject: Record<string, z.ZodTypeAny> = {};

        for (const [fieldName, field] of Object.entries(fields)) {
            const fieldSelectionSchema = graphqlOutputTypeToZodSelectionSchema(
                field.type,
                schema,
                new Set(visitedTypes) // Create a copy to avoid mutation issues
            );
            zodObject[fieldName] = fieldSelectionSchema;
        }

        visitedTypes.delete(type.name);
        return z.object(zodObject).strict().optional();
    }

    // Fallback for other types
    return z.boolean().optional();
}

// Generate Zod output selection schemas for all operations
export function generateOutputSelectionSchemas(operations: any[], schema: pkg.GraphQLSchema) {
    const outputSchemas: Record<string, z.ZodSchema> = {};

    for (const operation of operations) {
        const returnType = operation.field.type;
        const selectionSchema = graphqlOutputTypeToZodSelectionSchema(returnType, schema);
        outputSchemas[operation.name] = selectionSchema;
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