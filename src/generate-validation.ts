import pkg from 'graphql';
const { buildSchema, GraphQLSchema, parse, validate, execute, isNonNullType, isListType, isScalarType, isEnumType, isInputObjectType, GraphQLInputObjectType, GraphQLEnumType, GraphQLScalarType } = pkg;
import { z } from 'zod';

// Helper function to convert GraphQL type to Zod schema
function graphqlTypeToZodSchema(type: pkg.GraphQLType, schema: pkg.GraphQLSchema): z.ZodTypeAny {
    if (isNonNullType(type)) {
        return graphqlTypeToZodSchema(type.ofType, schema);
    }

    if (isListType(type)) {
        const itemSchema = graphqlTypeToZodSchema(type.ofType, schema);
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
        const values = type.getValues().map(value => value.value);
        return z.enum(values as [string, ...string[]]);
    }

    if (isInputObjectType(type)) {
        const fields = type.getFields();
        const zodObject: Record<string, z.ZodTypeAny> = {};

        for (const [fieldName, field] of Object.entries(fields)) {
            let fieldSchema = graphqlTypeToZodSchema(field.type, schema);

            // Make field optional if it's nullable
            if (!isNonNullType(field.type)) {
                fieldSchema = fieldSchema.optional();
            }

            zodObject[fieldName] = fieldSchema;
        }

        return z.object(zodObject);
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
                let argSchema = graphqlTypeToZodSchema(arg.type, schema);

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