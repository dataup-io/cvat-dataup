import React, { useEffect, useState } from 'react';
import {
    Row, Col, Card, Spin,
} from 'antd';
import { Pie } from '@ant-design/plots';
import { getCore, Job } from 'cvat-core-wrapper';
import { ReloadOutlined } from '@ant-design/icons';

interface Props {
    jobs: Job[];
    taskId: number;
}

const core = getCore();

function JobAnalytics(props: Props): JSX.Element {
    const { jobs: jobsInstance, taskId } = props;
    const [loading, setLoading] = useState(true);
    const [stageData, setStageData] = useState<any>(null);
    const [classData, setClassData] = useState<any>(null);

    const fetchJobData = async () => {
        try {
            setLoading(true);
            const jobs = jobsInstance;

            type StageKey = 'annotation' | 'validation' | 'acceptance';
            const stageCount: Record<StageKey, number> = {
                annotation: 0,
                validation: 0,
                acceptance: 0,
            };

            jobs.forEach((job: any) => {
                if (['annotation', 'validation', 'acceptance'].includes(job.stage)) {
                    stageCount[job.stage as StageKey] += 1;
                }
            });

            const stageLabels = Object.keys(stageCount).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
            const stageColors = ['#36A2EB', '#FFCE56', '#FF6384'];
            setStageData({
                data: stageLabels.map((label, idx) => ({
                    type: label,
                    value: Object.values(stageCount)[idx],
                    color: stageColors[idx],
                })),
                colors: stageColors,
            });

            // Fetch class distribution data for the entire task
            const taskClassDistribution = await core.analytics.stats.getClassDistribution({ taskID: taskId });
            const combinedClassCounts: Record<string, number> = {};

            Object.entries(taskClassDistribution.class_counts).forEach(([className, count]) => {
                combinedClassCounts[className] = count as number;
            });

            const classLabels = Object.keys(combinedClassCounts);
            const classColors = classLabels.map((_, idx) => {
                const hue = (360 * idx) / classLabels.length;
                return `hsl(${hue}, 70%, 50%)`;
            });

            setClassData({
                data: classLabels.map((label, idx) => ({
                    type: label,
                    value: combinedClassCounts[label],
                    color: classColors[idx],
                })),
                colors: classColors,
            });
        } catch (error) {
            console.error('Error fetching job data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobData();
    }, [jobsInstance]);

    const getPieConfig = (dataObj: any, totalLabel: string, totalValue: number) => ({
        data: dataObj?.data || [],
        angleField: 'value',
        colorField: 'type',
        color: dataObj?.colors,
        innerRadius: 0.7,
        legend: {
            color: {
                title: false,
                position: 'right',
                rowPadding: 5,
                itemMarker: 'circle',
            },
        },
        label: false,
        tooltip: {
            title: (datum: any) => `${datum.type}`,
        },
        annotations: [
            {
                type: 'text',
                style: {
                    text: `${totalLabel}\n${totalValue}`,
                    x: '50%',
                    y: '50%',
                    textAlign: 'center',
                    fontSize: 20,
                    fontStyle: 'bold',
                },
            },
        ],
        height: 350,
        autoFit: true,
    });

    return (
        <div style={{ marginTop: 24 }}>
            <Row gutter={24} justify='center'>
                <Col span={12}>
                    <Card
                        title='Jobs overview'
                        extra={<ReloadOutlined onClick={fetchJobData} style={{ cursor: 'pointer' }} />}
                    >
                        <div style={{
                            display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative',
                        }}
                        >
                            {loading || !stageData ? <Spin /> : (
                                <Pie {...getPieConfig(stageData, 'Total jobs', jobsInstance.length)} />
                            )}
                        </div>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card
                        title='Label distrubution'
                        extra={<ReloadOutlined onClick={fetchJobData} style={{ cursor: 'pointer' }} />}
                        style={{ position: 'relative', width: '100%' }}
                    >
                        <div style={{
                            display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative',
                        }}
                        >
                            {loading || !classData ? <Spin /> : (
                                <Pie {...getPieConfig(classData, 'Total instance', classData.data.reduce((sum: number, item: any) => sum + item.value, 0))} />
                            )}
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

export default JobAnalytics;
