import graphql from 'graphql';

interface OperationArg {
    name: string;
    type: string | any; // Can be string (for tests) or GraphQL type object
}

interface Operation {
    name: string;
    type: 'query' | 'mutation' | 'subscription';
    args: OperationArg[];
}

export type FieldSelection = {
    [key: string]: boolean | FieldSelection;
};

// Helper function to convert field selection object to GraphQL field selection string
function buildFieldSelectionString(selection: FieldSelection): string {
    const fields: string[] = [];

    for (const [fieldName, value] of Object.entries(selection)) {
        if (value === true) {
            fields.push(fieldName);
        } else if (value === false) {
            // Skip fields that are explicitly set to false
            continue;
        } else if (typeof value === 'object' && value !== null) {
            // Check if this is an inline fragment (type name starting with uppercase)
            if (isTypeName(fieldName)) {
                const nestedFields = buildFieldSelectionString(value);
                if (nestedFields) {
                    fields.push(`... on ${fieldName} { ${nestedFields} }`);
                }
            } else {
                // Regular nested object selection
                const nestedFields = buildFieldSelectionString(value);
                if (nestedFields) {
                    fields.push(`${fieldName} { ${nestedFields} }`);
                }
            }
        }
    }

    return fields.join(' ');
}

// Helper function to determine if a field name is likely a GraphQL type name
// Type names in GraphQL conventionally start with an uppercase letter
function isTypeName(fieldName: string): boolean {
    return /^[A-Z]/.test(fieldName);
}

export function generateQueryString(
    operation: Operation,
    variables: Record<string, any>,
    fieldSelection?: FieldSelection
): string {
    // Validate that all required variables are provided
    for (const arg of operation.args) {
        const argName = arg.name;
        if (!(argName in variables)) {
            // Check if this is a required (non-null) argument
            // Handle both string types (for tests) and GraphQL type objects (for actual use)
            const isRequired = typeof arg.type === 'string'
                ? arg.type.endsWith('!')
                : graphql.isNonNullType(arg.type);

            if (isRequired) {
                throw new Error(`Missing required variable: ${argName}`);
            }
        }
    }

    // Warn about extra variables that aren't used by the operation
    const expectedArgNames = new Set(operation.args.map(arg => arg.name));
    for (const varName in variables) {
        if (!expectedArgNames.has(varName)) {
            console.warn(`Warning: Variable '${varName}' is not used by operation '${operation.name}'`);
        }
    }

    // Convert types to strings for the query
    const args = operation.args.map((arg: OperationArg) => {
        const typeString = typeof arg.type === 'string' ? arg.type : arg.type.toString();
        return `$${arg.name}: ${typeString}`;
    }).join(', ');

    const fieldArgs = operation.args.map((arg: OperationArg) => `${arg.name}: $${arg.name}`).join(', ');

    // Build field selection string
    const fieldsToSelect = fieldSelection ? buildFieldSelectionString(fieldSelection) : '';

    // Only include parentheses if there are arguments
    const fieldArgsStr = fieldArgs ? `(${fieldArgs})` : '';
    const operationCall = fieldsToSelect && fieldsToSelect.trim()
        ? `${operation.name}${fieldArgsStr} { ${fieldsToSelect} }`
        : `${operation.name}${fieldArgsStr}`;

    // Only include parentheses in operation definition if there are arguments
    const argsStr = args ? `(${args})` : '';
    if (operation.type === 'query') {
        return `query ${operation.name}${argsStr} { ${operationCall} }`;
    } else if (operation.type === 'mutation') {
        return `mutation ${operation.name}${argsStr} { ${operationCall} }`;
    } else if (operation.type === 'subscription') {
        return `subscription ${operation.name}${argsStr} { ${operationCall} }`;
    }

    // This should never be reached due to the union type, but TypeScript requires a return
    throw new Error(`Unknown operation type: ${operation.type}`);
}