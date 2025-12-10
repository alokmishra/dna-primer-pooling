// components/PrimerDashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import PrimerUpload from './PrimerUpload';
import OptimizationPanel from './OptimizationPanel';
import ResultsDisplay from './ResultsDisplay';
import StatusPanel from './StatusPanel';
import PrimerGenerator from './PrimerGenerator';
import { primerApi } from '@/lib/api';
import { Primer, OptimizationResults } from '@/lib/types';
import { Alert, Tabs, Card, Space, Button } from 'antd';
import { UploadOutlined, ExperimentOutlined, BarChartOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;

export default function PrimerDashboard() {
    const [primers, setPrimers] = useState<Primer[]>([]);
    const [results, setResults] = useState<OptimizationResults | null>(null);
    const [activeTab, setActiveTab] = useState('upload');
    const [apiConnected, setApiConnected] = useState(false);
    const [loading, setLoading] = useState(false);

    // Check API connection on mount
    useEffect(() => {
        checkApiConnection();
    }, []);

    const checkApiConnection = async () => {
        setLoading(true);
        try {
            const response = await primerApi.testConnection();
            setApiConnected(response.connected);
        } catch (error) {
            console.error('Failed to connect to API:', error);
            setApiConnected(false);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadComplete = (data: any) => {
        setPrimers(data.primers);
        setActiveTab('analyze');
    };

    const handleOptimizationComplete = (newResults: OptimizationResults) => {
        setResults(newResults);
        setActiveTab('results');
    };

    const downloadTemplate = () => {
        const template = `id,gene,forward,reverse,notes
1,GAPDH,ACCACAGTCCATGCCATCAC,GCCAGAGAGAGAGAGAGAGA,Housekeeping gene
2,ACTB,CATGTACGTTGCTATCCAGGC,CTCCTTAATGTCACGCACGAT,Control gene
3,TP53,CGTCCAGATGAAGCTCCCAGA,GCAGCGCTCACAACCTCCGTC,Tumor suppressor
4,MYC,GGCTCCTGGCAAAAGGTCA,TTGAGGGGCATCGTCGCGG,Oncogene
5,EGFR,GCGAATGGGACGGCTGCGCA,CACACAGCAAAGCAGAAACTC,Growth factor receptor
6,VEGFA,AGGGCAGAATCATCACGAAGT,AGGGTCTCGATTGGATGGCA,Angiogenesis factor
7,CDKN2A,CGCAGGTTCTTGGTCACTGT,GCGCTACCTGATTCCAATTC,Cell cycle regulator
8,BRCA1,ATCTGGCGCACAGTAACAGC,CTGAATCCAGAACACCACGA,DNA repair gene
9,HER2,GACCTGCTGCGCGAGTATGTC,CGCAGGATGTGGTGGTGGAG,Receptor tyrosine kinase
10,KRAS,CTGTATCAAAGAATGGTCCTG,ATGAAAATGGTCAGAGAAACC,Oncogene`;

        const blob = new Blob([template], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'primer_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    if (!apiConnected && !loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="max-w-md">
                    <Alert
                        message="API Connection Required"
                        description={
                            <div className="space-y-4">
                                <p>Please start the Python API server:</p>
                                <pre className="bg-gray-800 text-white p-4 rounded text-sm">
                                    cd primer_optimizer<br />
                                    python run_api.py
                                </pre>
                                <p>The API should be running at: <code>http://localhost:8000</code></p>
                                <Button type="primary" onClick={checkApiConnection} loading={loading}>
                                    Retry Connection
                                </Button>
                            </div>
                        }
                        type="error"
                        showIcon
                    />
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <ExperimentOutlined className="h-8 w-8 text-blue-600 mr-3" />
                            <h1 className="text-2xl font-bold text-gray-900">
                                Primer Pool Optimizer
                            </h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Button
                                icon={<UploadOutlined />}
                                onClick={downloadTemplate}
                            >
                                Download Template
                            </Button>
                            <div className="flex items-center space-x-2">
                                <div className={`h-3 w-3 rounded-full ${apiConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className="text-sm text-gray-600">
                                    API {apiConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Card>
                    <Tabs activeKey={activeTab} onChange={setActiveTab}>
                        <TabPane
                            tab={
                                <span>
                                    <ThunderboltOutlined />
                                    Generate
                                </span>
                            }
                            key="generate"
                        >
                            <PrimerGenerator />
                        </TabPane>

                        <TabPane
                            tab={
                                <span>
                                    <UploadOutlined />
                                    Upload Primers
                                </span>
                            }
                            key="upload"
                        >
                            <PrimerUpload
                                onUploadComplete={handleUploadComplete}
                                primers={primers}
                            />
                        </TabPane>

                        <TabPane
                            tab={
                                <span>
                                    <ExperimentOutlined />
                                    Optimization
                                </span>
                            }
                            key="analyze"
                            disabled={primers.length === 0}
                        >
                            {primers.length > 0 ? (
                                <OptimizationPanel
                                    primers={primers}
                                    onOptimizationComplete={handleOptimizationComplete}
                                />
                            ) : (
                                <Alert
                                    message="No Primers Loaded"
                                    description="Please upload primers first"
                                    type="warning"
                                    showIcon
                                />
                            )}
                        </TabPane>

                        <TabPane
                            tab={
                                <span>
                                    <BarChartOutlined />
                                    Results
                                </span>
                            }
                            key="results"
                            disabled={!results}
                        >
                            {results ? (
                                <ResultsDisplay results={results} />
                            ) : (
                                <Alert
                                    message="No Results Available"
                                    description="Run an optimization first to see results"
                                    type="info"
                                    showIcon
                                />
                            )}
                        </TabPane>
                    </Tabs>
                </Card>

                {/* Status Panel */}
                <div className="mt-6">
                    <StatusPanel />
                </div>
            </main>
        </div>
    );
}