interface OperationArg {
    name: string;
    type: string;
}

interface Operation {
    name: string;
    type: 'query' | 'mutation' | 'subscription';
    args: OperationArg[];
}

type FieldSelection = {
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
            // Nested object selection
            const nestedFields = buildFieldSelectionString(value);
            if (nestedFields) {
                fields.push(`${fieldName} { ${nestedFields} }`);
            }
        }
    }

    return fields.join(' ');
}

export function generateQueryString(
    operation: Operation,
    variables: Record<string, any>,
    fieldSelection?: FieldSelection
): string {
    const args = operation.args.map((arg: OperationArg) => `$${arg.name}: ${arg.type}`).join(', ');
    const fieldArgs = operation.args.map((arg: OperationArg) => `${arg.name}: $${arg.name}`).join(', ');

    // Build field selection string
    const fieldsToSelect = fieldSelection ? buildFieldSelectionString(fieldSelection) : '';
    const operationCall = fieldsToSelect && fieldsToSelect.trim()
        ? `${operation.name}(${fieldArgs}) { ${fieldsToSelect} }`
        : `${operation.name}(${fieldArgs})`;

    if (operation.type === 'query') {
        return `query ${operation.name}(${args}) { ${operationCall} }`;
    } else if (operation.type === 'mutation') {
        return `mutation ${operation.name}(${args}) { ${operationCall} }`;
    } else if (operation.type === 'subscription') {
        return `subscription ${operation.name}(${args}) { ${operationCall} }`;
    }

    // This should never be reached due to the union type, but TypeScript requires a return
    throw new Error(`Unknown operation type: ${operation.type}`);
}