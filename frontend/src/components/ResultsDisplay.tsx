// components/ResultsDisplay.tsx
'use client';

import React from 'react';
import { Card, Table, Progress, Row, Col, Statistic, Button, Alert } from 'antd';
import { DownloadOutlined, CopyOutlined } from '@ant-design/icons';
import { OptimizationResults, PrimerResult } from '@/lib/types';
import * as XLSX from 'xlsx';

interface ResultsDisplayProps {
    results: OptimizationResults;
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
    const { metrics, pools, optimization_score } = results;

    // Prepare summary data for table
    const summaryData = metrics.pool_sizes.map((size, index) => ({
        key: index,
        pool: index + 1,
        size,
        avgTm: metrics.avg_tm_per_pool[index]?.toFixed(1) || 'N/A',
        tmRange: metrics.tm_range_per_pool[index]?.toFixed(1) || 'N/A',
        maxDimer: metrics.max_dimer_per_pool[index]?.toFixed(2) || 'N/A',
    }));

    // Prepare detailed data for each pool
    const allPrimers: (PrimerResult & { pool: number })[] = [];
    pools.forEach((pool, poolIndex) => {
        pool.forEach(primer => {
            allPrimers.push({ ...primer, pool: poolIndex + 1 });
        });
    });

    // Export to Excel
    const exportToExcel = () => {
        // Create workbook
        const wb = XLSX.utils.book_new();

        // Summary sheet
        const summaryWs = XLSX.utils.json_to_sheet(summaryData.map(d => ({
            Pool: d.pool,
            'Primer Count': d.size,
            'Average Tm (°C)': d.avgTm,
            'Tm Range (°C)': d.tmRange,
            'Max Dimer Score': d.maxDimer,
        })));
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

        // Detailed sheets for each pool
        pools.forEach((pool, index) => {
            const poolData = pool.map(p => ({
                Pool: index + 1,
                ID: p.id,
                Gene: p.gene,
                'Forward Primer': p.forward,
                'Reverse Primer': p.reverse,
                'Forward Tm (°C)': p.forward_tm.toFixed(1),
                'Reverse Tm (°C)': p.reverse_tm.toFixed(1),
                'Average Tm (°C)': p.avg_tm.toFixed(1),
                'GC Content (%)': p.gc_content.toFixed(1),
                'Compatibility Score': p.compatibility_score.toFixed(2),
            }));
            const ws = XLSX.utils.json_to_sheet(poolData);
            XLSX.utils.book_append_sheet(wb, ws, `Pool ${index + 1}`);
        });

        // Save file
        XLSX.writeFile(wb, `primer_pools_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Copy summary to clipboard
    const copySummary = async () => {
        const summaryText = `Primer Pool Optimization Results\n\n` +
            `Optimization Score: ${optimization_score.toFixed(2)}\n\n` +
            summaryData.map(d =>
                `Pool ${d.pool}: ${d.size} primers, Avg Tm: ${d.avgTm}°C, Max Dimer: ${d.maxDimer}`
            ).join('\n');

        try {
            await navigator.clipboard.writeText(summaryText);
            alert('Summary copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Columns for summary table
    const summaryColumns = [
        { title: 'Pool', dataIndex: 'pool', key: 'pool' },
        { title: 'Primers', dataIndex: 'size', key: 'size' },
        { title: 'Avg Tm (°C)', dataIndex: 'avgTm', key: 'avgTm' },
        { title: 'Tm Range (°C)', dataIndex: 'tmRange', key: 'tmRange' },
        { title: 'Max Dimer', dataIndex: 'maxDimer', key: 'maxDimer' },
    ];

    // Columns for detailed table
    const detailedColumns = [
        { title: 'Pool', dataIndex: 'pool', key: 'pool' },
        { title: 'ID', dataIndex: 'id', key: 'id' },
        { title: 'Gene', dataIndex: 'gene', key: 'gene' },
        { title: 'Forward Primer', dataIndex: 'forward', key: 'forward' },
        { title: 'Reverse Primer', dataIndex: 'reverse', key: 'reverse' },
        { title: 'Avg Tm (°C)', dataIndex: 'avg_tm', key: 'avg_tm', render: (v: number) => v.toFixed(1) },
    ];

    return (
        <div className="space-y-6">
            {/* Optimization Score */}
            <Card>
                <div className="text-center mb-4">
                    <h2 className="text-2xl font-bold mb-2">Optimization Complete</h2>
                    <div className="text-lg">
                        Score: <span className="font-bold">{optimization_score.toFixed(2)}</span>
                        <span className="ml-4 text-sm text-gray-500">(Lower is better)</span>
                        {results.duration_seconds && (
                            <span className="ml-6 text-sm">
                                Time: <span className="font-bold">{results.duration_seconds.toFixed(2)}s</span>
                            </span>
                        )}
                    </div>
                </div>

                <Row gutter={16} className="mb-6">
                    <Col span={6}>
                        <Statistic
                            title="Total Primers"
                            value={allPrimers.length}
                        />
                    </Col>
                    <Col span={6}>
                        <Statistic
                            title="Number of Pools"
                            value={pools.length}
                        />
                    </Col>
                    <Col span={6}>
                        <Statistic
                            title="Average Pool Size"
                            value={Math.round(allPrimers.length / pools.length)}
                        />
                    </Col>
                    <Col span={6}>
                        <Statistic
                            title="Best Pool Score"
                            value={Math.min(...metrics.max_dimer_per_pool).toFixed(2)}
                        />
                    </Col>
                </Row>

                {/* Dimer Score Visualization */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Pool Dimer Scores</h3>
                    {metrics.max_dimer_per_pool.map((score, index) => (
                        <div key={index} className="mb-2">
                            <div className="flex justify-between mb-1">
                                <span>Pool {index + 1}</span>
                                <span>{score.toFixed(2)}</span>
                            </div>
                            <Progress
                                percent={Math.min(score * 10, 100)}
                                status={score > 8 ? 'exception' : score > 5 ? 'normal' : 'success'}
                                strokeColor={score > 8 ? '#ff4d4f' : score > 5 ? '#faad14' : '#52c41a'}
                            />
                            <div className="text-xs text-gray-500 mt-1">
                                {score <= 3 ? 'Excellent' :
                                    score <= 5 ? 'Good' :
                                        score <= 8 ? 'Acceptable' :
                                            'High risk of dimerization'}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Summary Table */}
            <Card title="Pool Summary">
                <Table
                    dataSource={summaryData}
                    columns={summaryColumns}
                    pagination={false}
                    className="mb-4"
                />

                <div className="flex space-x-4">
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={exportToExcel}
                        size="large"
                    >
                        Export to Excel
                    </Button>
                    <Button
                        icon={<CopyOutlined />}
                        onClick={copySummary}
                        size="large"
                    >
                        Copy Summary
                    </Button>
                </div>
            </Card>

            {/* Detailed Results */}
            <Card title="Detailed Results">
                <Alert
                    message="Primer Distribution"
                    description={`All ${allPrimers.length} primers distributed across ${pools.length} pools`}
                    type="info"
                    showIcon
                    className="mb-4"
                />

                <Table
                    dataSource={allPrimers.slice(0, 50)} // Show first 50 for performance
                    columns={detailedColumns}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 800 }}
                />

                {allPrimers.length > 50 && (
                    <div className="text-center mt-4 text-gray-500">
                        Showing 50 of {allPrimers.length} primers. Export to Excel for complete list.
                    </div>
                )}
            </Card>

            {/* Recommendations */}
            <Card title="Recommendations">
                <div className="space-y-3">
                    {metrics.max_dimer_per_pool.some(score => score > 8) && (
                        <Alert
                            message="High Dimer Risk"
                            description="Some pools have high dimer scores. Consider re-running with stricter parameters or manually adjusting problematic primers."
                            type="warning"
                            showIcon
                        />
                    )}

                    {metrics.tm_range_per_pool.some(range => range > 5) && (
                        <Alert
                            message="Large Tm Variation"
                            description="Some pools have large Tm ranges. This may affect PCR efficiency."
                            type="info"
                            showIcon
                        />
                    )}

                    <div className="bg-blue-50 p-4 rounded">
                        <h4 className="font-bold mb-2">Next Steps:</h4>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>Download the Excel file for complete results</li>
                            <li>Verify primer sequences in each pool</li>
                            <li>Test pools with in-silico PCR simulation</li>
                            <li>Consider experimental validation with control templates</li>
                        </ol>
                    </div>
                </div>
            </Card>
        </div>
    );
}