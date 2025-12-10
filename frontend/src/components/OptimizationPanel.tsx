// app/components/OptimizationPanel.tsx
'use client';

import React, { useState } from 'react';
import { Card, Slider, Button, InputNumber, Alert } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
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
                    <Alert
                        message="Optimization Complete"
                        description="Results are available in the Results tab."
                        type="success"
                        showIcon
                    />
                )}
            </div>
        </Card>
    );
}