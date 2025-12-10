// app/components/OptimizationPanel.tsx
'use client';

import React, { useState } from 'react';
import { Card, Slider, Button, InputNumber, Alert, Progress, Table } from 'antd';
import { PlayCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { primerApi } from '../lib/api';

interface OptimizationPanelProps {
    primers: any[];
    onOptimizationComplete?: (results: any) => void;
}

export default function OptimizationPanel({ primers, onOptimizationComplete }: OptimizationPanelProps) {
    const [nPools, setNPools] = useState(4);
    const [maxPrimersPerPool, setMaxPrimersPerPool] = useState(50);
    const [optimizing, setOptimizing] = useState(false);
    const [results, setResults] = useState<any>(null);

    // Calculate minimum required pools based on constraint
    const minPools = Math.ceil(primers.length / maxPrimersPerPool);

    React.useEffect(() => {
        // Ensure nPools is at least minPools
        if (nPools < minPools) {
            setNPools(minPools);
        }
    }, [maxPrimersPerPool, primers.length, minPools, nPools]);

    React.useEffect(() => {
        if (primers.length > 0 && nPools > primers.length) {
            setNPools(primers.length);
        }
    }, [primers.length, nPools]);

    const runOptimization = async () => {
        if (primers.length === 0) return;

        setOptimizing(true);

        try {
            const data = await primerApi.startOptimization({
                primers: primers,
                n_pools: nPools,
                max_primers_per_pool: maxPrimersPerPool,
                max_iterations: 1000
            });

            // Poll for results
            const pollResults = async (jobId: string) => {
                const resultData = await primerApi.getJobStatus(jobId);

                if (resultData.status === 'completed') {
                    setResults(resultData.results);
                    setOptimizing(false);
                    if (onOptimizationComplete) {
                        onOptimizationComplete(resultData.results);
                    }
                } else if (resultData.status === 'processing') {

                    setTimeout(() => pollResults(jobId), 2000);
                } else {
                    setOptimizing(false);
                }
            };

            pollResults(data.job_id);

        } catch (error) {
            console.error('Optimization failed:', error);
            setOptimizing(false);
        }
    };

    const downloadResults = () => {
        if (!results) return;

        const jsonStr = JSON.stringify(results, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'optimization_results.json';
        a.click();
    };

    const poolColumns = [
        { title: 'Pool', dataIndex: 'pool', key: 'pool' },
        { title: 'Primers', dataIndex: 'size', key: 'size' },
        { title: 'Avg Tm (°C)', dataIndex: 'avgTm', key: 'avgTm', render: (v: number) => v.toFixed(1) },
        { title: 'Tm Range', dataIndex: 'tmRange', key: 'tmRange', render: (v: number) => v.toFixed(1) },
        { title: 'Max Dimer', dataIndex: 'maxDimer', key: 'maxDimer', render: (v: number) => v.toFixed(2) },
    ];

    return (
        <Card title="Pool Optimization">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block mb-2">
                            Number of Pools: {nPools}
                            {minPools > 2 && <span className="text-gray-500 text-xs ml-2">(Min required: {minPools})</span>}
                        </label>
                        <Slider
                            min={Math.max(2, minPools)}
                            max={Math.max(2, primers.length)}
                            value={nPools}
                            onChange={(val) => setNPools(Math.max(val, minPools))}
                            marks={{
                                [Math.max(2, minPools)]: String(Math.max(2, minPools)),
                                [Math.max(2, primers.length)]: String(Math.max(2, primers.length))
                            }}
                        />
                    </div>

                    <div>
                        <label className="block mb-2">Max Primers per Pool</label>
                        <InputNumber
                            min={10}
                            max={1000}
                            value={maxPrimersPerPool}
                            onChange={(val) => val !== null && setMaxPrimersPerPool(val)}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>

                <div className="flex space-x-4">
                    <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={runOptimization}
                        loading={optimizing}
                        size="large"
                    >
                        {optimizing ? 'Optimizing...' : 'Run Optimization'}
                    </Button>

                    {results && (
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={downloadResults}
                            size="large"
                        >
                            Download Results
                        </Button>
                    )}
                </div>

                {optimizing && (
                    <Alert
                        message="Optimization in Progress"
                        description="This may take several minutes for large datasets. The system is analyzing dimer interactions and optimizing pool assignments."
                        type="info"
                        showIcon
                    />
                )}

                {results && (
                    <div className="space-y-4">
                        <Alert
                            message={`Optimization Complete - Score: ${results.optimization_score.toFixed(2)}`}
                            type="success"
                            showIcon
                        />

                        <Table
                            dataSource={results.metrics.pool_sizes.map((size: number, i: number) => ({
                                key: i,
                                pool: i + 1,
                                size,
                                avgTm: results.metrics.avg_tm_per_pool[i],
                                tmRange: results.metrics.tm_range_per_pool[i],
                                maxDimer: results.metrics.max_dimer_per_pool[i]
                            }))}
                            columns={poolColumns}
                            pagination={false}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {results.pools.map((pool: any[], i: number) => (
                                <Card key={i} size="small" title={`Pool ${i + 1} (${pool.length} primers)`}>
                                    <Table
                                        dataSource={pool}
                                        columns={[
                                            { title: 'ID', dataIndex: 'id', key: 'id' },
                                            { title: 'Gene', dataIndex: 'gene', key: 'gene' },
                                            { title: 'Avg Tm', dataIndex: 'avg_tm', key: 'avg_tm', render: (v) => v.toFixed(1) },
                                        ]}
                                        size="small"
                                        pagination={{ pageSize: 5 }}
                                    />
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}