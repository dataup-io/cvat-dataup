// Types and constants for the Steps components

export interface StepParameter {
    key: string;
    param_type: string;
    default_value: any;
    description: string;
    required: boolean;
}

export interface PipelineStep {
    id: string;
    type: string;
    name: string;
    category: string;
    description: string;
    parameters: StepParameter[];
}

export interface StepsResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: PipelineStep[];
}

// Constants for consistent styling and theming
export const CARD_GRID_CONFIG = { xs: 24, sm: 12, lg: 8, xl: 4 };
export const FILTER_GRID_CONFIG = { gutter: 16, style: { marginBottom: 24 } };
export const PARAMETER_TYPE_COLORS: Record<string, string> = {
    string: 'blue',
    float: 'green',
    number: 'green',
    boolean: 'orange',
    array: 'purple',
    object: 'red'
};

export const CATEGORY_COLORS: Record<string, string> = {
    agent: '#1890ff',
    processing: '#52c41a',
    analysis: '#fa8c16',
    export: '#722ed1'
};