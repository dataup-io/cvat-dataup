import React, { useState, useEffect } from 'react';
import {
    Button, Tooltip, notification, Modal,
} from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { JobStage } from 'cvat-core-wrapper';

interface SubmitButtonProps {
    jobInstance: any;
    onSubmitJob: (jobInstance: any) => any;
}

type NotificationType = 'success' | 'info' | 'warning' | 'error';

export default function SubmitButton(props: SubmitButtonProps): JSX.Element {
    const { jobInstance, onSubmitJob } = props;
    const [loading, setLoading] = useState(false);
    const [currentStage, setCurrentStage] = useState<JobStage>(jobInstance.stage);
    const [api, contextHolder] = notification.useNotification();

    useEffect(() => {
        setCurrentStage(jobInstance.stage);
    }, [jobInstance.stage]);

    const openNotification = (type: NotificationType, message: string) => {
        api[type]({
            message,
            placement: 'topRight',
        });
    };

    const getButtonText = (stage: JobStage): string => {
        switch (stage) {
            case JobStage.ANNOTATION:
                return 'Submit for Validation';
            case JobStage.VALIDATION:
                return 'Submit for Acceptance';
            case JobStage.ACCEPTANCE:
                return 'Complete Job';
            default:
                return 'Submit';
        }
    };

    const getTooltipText = (stage: JobStage): string => {
        switch (stage) {
            case JobStage.ANNOTATION:
                return 'Complete annotation and submit for validation';
            case JobStage.VALIDATION:
                return 'Complete validation and submit for final acceptance';
            case JobStage.ACCEPTANCE:
                return 'Mark job as completed';
            default:
                return 'Submit and advance to the next stage';
        }
    };

    const getSuccessMessage = (stage: JobStage): string => {
        switch (stage) {
            case JobStage.ANNOTATION:
                return 'Successfully submitted for validation';
            case JobStage.VALIDATION:
                return 'Successfully submitted for acceptance';
            case JobStage.ACCEPTANCE:
                return 'Job successfully completed';
            default:
                return 'Successfully submitted';
        }
    };

    const handleSubmit = async () => {
        try {
            if (jobInstance.annotations.hasUnsavedChanges()) {
                Modal.confirm({
                    title: 'Unsaved Changes',
                    content: 'You have unsaved changes. Do you want to save them before submitting?',
                    okText: 'Save and Submit',
                    cancelText: 'Submit without Saving',
                    onOk: async () => {
                        setLoading(true);
                        try {
                            if (currentStage === JobStage.ACCEPTANCE && jobInstance.state === 'completed') {
                                return;
                            }
                            await jobInstance.annotations.save();
                            const originalStage = currentStage;
                            await onSubmitJob(jobInstance);
                            openNotification('success', getSuccessMessage(originalStage));
                        } catch (error) {
                            console.error(error);
                            openNotification('error', 'Failed to submit job');
                        } finally {
                            setLoading(false);
                        }
                    },
                    onCancel: async () => {
                        setLoading(true);
                        try {
                            if (currentStage === JobStage.ACCEPTANCE && jobInstance.state === 'completed') {
                                return;
                            }
                            const originalStage = currentStage;
                            await onSubmitJob(jobInstance);
                            openNotification('success', getSuccessMessage(originalStage));
                        } catch (error) {
                            console.error(error);
                            openNotification('error', 'Failed to submit job');
                        } finally {
                            setLoading(false);
                        }
                    },
                });
            } else {
                setLoading(true);
                if (currentStage === JobStage.ACCEPTANCE && jobInstance.state === 'completed') {
                    return;
                }
                const originalStage = currentStage;
                await onSubmitJob(jobInstance);
                openNotification('success', getSuccessMessage(originalStage));
                await setLoading(false);
            }
        } catch (error) {
            console.error(error);
            openNotification('error', 'Failed to submit job');
            setLoading(false);
        }
    };

    const isDisabled = currentStage === JobStage.ACCEPTANCE && jobInstance.state === 'completed';
    const tooltipText = isDisabled ? 'Job completed' : getTooltipText(currentStage);
    const buttonText = isDisabled ? 'Done' : getButtonText(currentStage);

    return (
        <>
            {contextHolder}
            <Tooltip title={tooltipText}>
                <Button
                    type='primary'
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleSubmit()}
                    loading={loading}
                    disabled={isDisabled || loading}
                >
                    {buttonText}
                </Button>
            </Tooltip>
        </>
    );
}
