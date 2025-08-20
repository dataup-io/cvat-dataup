import { Config } from '@react-awesome-query-builder/antd';

const predefinedFilterValues = {
    provider: [
        { value: 'huggingface', title: 'Huggingface' },
        { value: 'roboflow', title: 'Roboflow' },
        { value: 'landingai', title: 'LandingAI' },
        { value: 'dataup', title: 'DataUp' },
        { value: 'zinkiai', title: 'ZinkiAI' },
    ],
    status: {
        active: 'active',
        inactive: 'inactive',
    },
};

export const config: Partial<Config> = {
    fields: {
        provider: {
            label: 'Provider',
            type: 'select',
            valueSources: ['value'],
            operators: ['equal'],
            fieldSettings: {
                listValues: predefinedFilterValues.provider,
            },
        },
        is_active: {
            label: 'Status',
            type: 'select',
            valueSources: ['value'],
            operators: ['equal'],
            fieldSettings: {
                listValues: [
                    { value: predefinedFilterValues.status.active, title: 'Active' },
                    { value: predefinedFilterValues.status.inactive, title: 'Inactive' },
                ],
            },
        },
    },
};

export const localStorageRecentKeyword = 'recentlyAppliedAgentApisFilters';

export const defaultFields = [
    'provider',
    'is_active',
];
