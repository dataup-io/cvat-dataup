import React, { useState } from 'react';
import {
    Col, Row, Button, message,
} from 'antd';
import { CheckCircleOutlined, StarFilled } from '@ant-design/icons';
import './styles.scss';

const plans = [
    {
        title: 'Starter Plan',
        subtitle: 'For Growing Teams',
        price: '$99 /Month',
        features: [
            'Up to 10,000 annotated data points',
            'Basic quality assurance',
            'Standard 5-day turnaround time',
        ],
        mostPopular: false,
    },
    {
        title: 'Professional Plan',
        subtitle: 'For Scaling Projects',
        price: '$299 /Month',
        features: [
            'Advanced quality assurance',
            'Live chat support',
            'Dedicated account manager',
            'Email support',
            'Standard 5-day turnaround time',
        ],
        mostPopular: true,
    },
    {
        title: 'Enterprise Plan',
        subtitle: 'For Large-Scale Needs',
        price: '$299 /Month',
        features: [
            'Up to 10,000 annotated data points',
            'Standard 5-day turnaround time',
            'Email support',
            'Advanced quality assurance',
            'Dedicated account manager',
            'Live chat support',
        ],
        mostPopular: false,
    },
];

function PlanUpgradePage(): JSX.Element {
    const [buttonsDisabled, setButtonsDisabled] = useState(false);
    const handleChoosePlan = (planName: string): void => {
        setButtonsDisabled(true);
        message.success({
            content: `🎉 Thank you for choosing the ${planName}. Our team will contact you shortly.`,
            duration: 4,
            style: {
                marginTop: '20vh',
                fontSize: '1rem',
            },
            onClose: () => {
                setButtonsDisabled(false);
            },
        });
    };
    return (
        <div className='plan-upgrade-page'>
            <h1 className='page-title'>Upgrade Your Plan</h1>
            <p className='page-subtitle'>Choose the right plan to scale your data annotation workflow</p>

            <Row gutter={[24, 24]} justify='center'>
                {plans.map((plan) => (
                    <Col xs={24} md={8} key={plan.title}>
                        <div className={`creative-plan-card ${plan.mostPopular ? 'highlight' : ''}`}>
                            {plan.mostPopular && (
                                <div className='highlight-badge'>
                                    <StarFilled />
                                    {' '}
Most Popular
                                </div>
                            )}
                            <div className='plan-pricing'>
                                <span className='price'>{plan.price}</span>
                                <span className='title'>{plan.title}</span>
                                <span className='subtitle'>{plan.subtitle}</span>
                            </div>
                            <ul className='features'>
                                {plan.features.map((feature) => (
                                    <li key={feature}>
                                        <CheckCircleOutlined className='icon' />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <Button
                                type='primary'
                                className='select-button'
                                block
                                onClick={(): void => handleChoosePlan(plan.title)}
                                disabled={buttonsDisabled}
                            >
                                Choose Plan
                            </Button>
                        </div>
                    </Col>
                ))}
            </Row>
        </div>
    );
}

export default PlanUpgradePage;
