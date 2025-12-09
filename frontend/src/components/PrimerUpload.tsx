// app/components/PrimerUpload.tsx
'use client';

import React, { useState } from 'react';
import { Upload, Alert, Table, Progress, Card, Button, Space } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';

interface Primer {
    id: string;
    gene: string;
    forward: string;
    reverse: string;
}

interface PrimerUploadProps {
    onUploadComplete?: (data: any) => void;
    primers?: Primer[];
}

export default function PrimerUpload({ onUploadComplete, primers: externalPrimers }: PrimerUploadProps) {
    const [internalPrimers, setInternalPrimers] = useState<Primer[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [analysisResults, setAnalysisResults] = useState<any>(null);

    const primers = externalPrimers || internalPrimers;

    const handleUpload = async (file: File) => {
        setLoading(true);
        setUploadProgress(10);

        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploadProgress(30);
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            setUploadProgress(70);
            const data = await response.json();

            if (data.status === 'success') {
                setInternalPrimers(data.primers);
                setAnalysisResults(data.quick_analysis);
                if (onUploadComplete) {
                    onUploadComplete(data);
                }
            }

            setUploadProgress(100);
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setLoading(false);
        }

        return false; // Prevent default upload
    };

    const downloadTemplate = () => {
        const template = `id,gene,forward,reverse,notes
1,GAPDH,ACCACAGTCCATGCCATCAC,GCCAGAGAGAGAGAGAGAGA,Housekeeping
2,ACTB,CATGTACGTTGCTATCCAGGC,CTCCTTAATGTCACGCACGAT,Control
3,MYC,GGCTCCTGGCAAAAGGTCA,TTGAGGGGCATCGTCGCGG,Oncogene`;

        const blob = new Blob([template], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'primer_template.csv';
        a.click();
    };

    const columns = [
        { title: 'ID', dataIndex: 'id', key: 'id' },
        { title: 'Gene', dataIndex: 'gene', key: 'gene' },
        { title: 'Forward Primer', dataIndex: 'forward', key: 'forward' },
        { title: 'Reverse Primer', dataIndex: 'reverse', key: 'reverse' },
    ];

    return (
        <div className="space-y-6">
            <Card title="Upload Primer File">
                <Space direction="vertical" size="large" className="w-full">
                    <Alert
                        message="Upload Requirements"
                        description="Upload Excel (.xlsx) or CSV file with columns: id, gene, forward, reverse"
                        type="info"
                        showIcon
                    />

                    <div className="flex space-x-4">
                        <Upload
                            accept=".xlsx,.xls,.csv"
                            beforeUpload={handleUpload}
                            showUploadList={false}
                        >
                            <Button icon={<UploadOutlined />} size="large">
                                Upload File
                            </Button>
                        </Upload>

                        <Button
                            icon={<DownloadOutlined />}
                            onClick={downloadTemplate}
                            size="large"
                        >
                            Download Template
                        </Button>
                    </div>

                    {loading && (
                        <Progress percent={uploadProgress} status="active" />
                    )}
                </Space>
            </Card>

            {primers.length > 0 && (
                <Card title={`Loaded Primers (${primers.length})`}>
                    <Table
                        dataSource={primers}
                        columns={columns}
                        pagination={{ pageSize: 10 }}
                        rowKey="id"
                    />
                </Card>
            )}

            {analysisResults && (
                <Card title="Quick Analysis Results">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card size="small">
                            <h4>Pool Sizes</h4>
                            {analysisResults.pool_sizes?.map((size: number, i: number) => (
                                <div key={i}>Pool {i + 1}: {size} primers</div>
                            ))}
                        </Card>
                        <Card size="small">
                            <h4>Average Tm</h4>
                            {analysisResults.avg_tm_per_pool?.map((tm: number, i: number) => (
                                <div key={i}>Pool {i + 1}: {tm.toFixed(1)}°C</div>
                            ))}
                        </Card>
                        <Card size="small">
                            <h4>Max Dimer Score</h4>
                            {analysisResults.max_dimer_per_pool?.map((score: number, i: number) => (
                                <div key={i}>Pool {i + 1}: {score.toFixed(1)}</div>
                            ))}
                        </Card>
                    </div>
                </Card>
            )}
        </div>
    );
}