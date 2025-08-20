import React from 'react';
import { Row, Col, Input, Select, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { FILTER_GRID_CONFIG } from './types';

const { Text } = Typography;
const { Option } = Select;

interface StepsFiltersProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    categories: string[];
    filteredCount: number;
    totalCount: number;
}

const StepsFilters: React.FC<StepsFiltersProps> = ({
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    categories,
    filteredCount,
    totalCount
}) => (
    <div className="steps-filters">
        <Row {...FILTER_GRID_CONFIG}>
            <Col span={12}>
                <Input
                    placeholder="Search steps by name, type, or description..."
                    prefix={<SearchOutlined />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    allowClear
                />
            </Col>
            <Col span={6}>
                <Select
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    style={{ width: '100%' }}
                    placeholder="Filter by category"
                >
                    {categories.map(category => (
                        <Option key={category} value={category}>
                            {category === 'all'
                                ? 'All Categories'
                                : `${category.charAt(0).toUpperCase()}${category.slice(1)}`
                            }
                        </Option>
                    ))}
                </Select>
            </Col>
            <Col span={6}>
                <Text type="secondary">
                    {filteredCount} of {totalCount} steps
                </Text>
            </Col>
        </Row>
    </div>
);

export default React.memo(StepsFilters);