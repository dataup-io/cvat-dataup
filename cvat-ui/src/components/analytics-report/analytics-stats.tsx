import React, { useCallback, useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { Card, Typography } from "antd";
import { Label } from "cvat-core-wrapper";
import NothingToSee from "./views/NothingToSee";

const { Text, Title } = Typography;

ChartJS.register(ArcElement, Tooltip);

/* types */
type StatsData = Record<string, Record<string, number>>;

type StatsOverviewProps = {
    statsData: StatsData;
    labelsData: Label[];
};
/*=============================================================*/

/* Helpers */
const getLabelColor = (label: string) => {
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${hash % 360}, 70%, 50%)`;
};

/*=============================================================*/

const StatsOverview: React.FC<StatsOverviewProps> = ({ statsData, labelsData }) => {
    if (!statsData || Object.keys(statsData).length === 0) {
        return (
            <Card>
                <Text>No data available.</Text>
            </Card>
        );
    }

    const labelColorMap = useMemo(() => {
        return labelsData.reduce((acc, label) => {
            acc[label.name.toLowerCase()] = label.color || getLabelColor(label.name);
            return acc;
        }, {} as Record<string, string>);
    }, [labelsData]);

    const createChartData = useCallback((data: Record<string, number>) => {
        const labels = Object.keys(data);
        const counts = Object.values(data);
        const colors = labels.map(label => labelColorMap[label.toLowerCase()] || getLabelColor(label));
        const total = counts.reduce((sum, count) => sum + count, 0);

        return {
            labels,
            datasets: [
                {
                    label: "Count",
                    data: counts,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1,
                },
            ],
            total,
        };
    }, [labelColorMap]);

    const chartDataMap = useMemo(() => {
        return Object.entries(statsData).map(([key, value]) => ({
            key,
            data: createChartData(value),
        }));
    }, [statsData, labelColorMap]);

    return (
        <div className="cvat-stats-overview" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))", gap: "20px", justifyContent: "center", padding: "20px" }}>
            {chartDataMap.map(({ key, data }) => (
                <Card key={key} style={{ padding: "20px", textAlign: "center", minWidth: "500px" }}>
                    <Title level={4} style={{ marginBottom: "8px" }}>{key.replace("_", " ")} status</Title>
                    <Text type="secondary" style={{ marginBottom: "16px", display: "block" }}>
                        An overview of the status of your {key.replace("_", " ")}
                    </Text>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
                        {Object.keys(statsData[key]).length === 0 ? (
                            <NothingToSee message={`No data available for ${key.replace("_", " ")}`} />
                        ) : (
                            <div style={{ position: "relative", width: "100%", maxWidth: "350px", height: "350px" }}>
                                <Doughnut
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { display: true, labels: { usePointStyle: true } } // Remove legend
                                        }
                                    }}
                                    data={{
                                        ...data,
                                        datasets: [
                                            {
                                                ...data.datasets[0],
                                                cutout: "70%", // More space for center text
                                            },
                                        ],
                                    }}
                                />
                                <div style={{
                                    position: "absolute",
                                    top: "55%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    fontSize: "24px",
                                    fontWeight: "bold",
                                    color: "#333"
                                }}>
                                    {data.total}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            ))}
        </div>
    );
};

export default React.memo(StatsOverview);