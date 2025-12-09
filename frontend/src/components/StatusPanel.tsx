// components/StatusPanel.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, Progress, Alert, Space, Button, Tag, Spin } from 'antd';
import { SyncOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { primerApi } from '@/lib/api';

export default function StatusPanel() {
    const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
    const [serverStats, setServerStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const checkStatus = async () => {
        setLoading(true);
        try {
            const stats = await primerApi.getStats();
            setServerStats(stats);
            setApiStatus('connected');
        } catch (error) {
            console.error('Failed to check status:', error);
            setApiStatus('disconnected');
            setServerStats(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();

        // Check every 30 seconds
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const renderStatusIcon = () => {
        switch (apiStatus) {
            case 'connected':
                return <CheckCircleOutlined className="text-green-500" />;
            case 'disconnected':
                return <WarningOutlined className="text-red-500" />;
            default:
                return <SyncOutlined spin className="text-blue-500" />;
        }
    };

    const renderStatusText = () => {
        switch (apiStatus) {
            case 'connected':
                return 'API Connected';
            case 'disconnected':
                return 'API Disconnected';
            default:
                return 'Checking...';
        }
    };

    return (
        <Card title="System Status" size="small">
            <div className="space-y-4">
                {/* Connection Status */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        {renderStatusIcon()}
                        <span className="font-medium">{renderStatusText()}</span>
                        <Tag color={apiStatus === 'connected' ? 'success' : apiStatus === 'disconnected' ? 'error' : 'processing'}>
                            {apiStatus === 'connected' ? 'Online' : apiStatus === 'disconnected' ? 'Offline' : 'Checking'}
                        </Tag>
                    </div>

                    <Button
                        size="small"
                        icon={<SyncOutlined />}
                        onClick={checkStatus}
                        loading={loading}
                    >
                        Refresh
                    </Button>
                </div>

                {/* Server Stats */}
                {apiStatus === 'connected' && serverStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-600">Total Jobs</div>
                            <div className="text-2xl font-bold">{serverStats.total_jobs || 0}</div>
                        </div>

                        <div className="bg-green-50 p-3 rounded">
                            <div className="text-sm text-green-600">Completed</div>
                            <div className="text-2xl font-bold text-green-600">{serverStats.completed || 0}</div>
                        </div>

                        <div className="bg-blue-50 p-3 rounded">
                            <div className="text-sm text-blue-600">Processing</div>
                            <div className="text-2xl font-bold text-blue-600">{serverStats.processing || 0}</div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-600">Success Rate</div>
                            <div className="text-2xl font-bold">
                                {serverStats.total_jobs > 0
                                    ? `${Math.round((serverStats.completed / serverStats.total_jobs) * 100)}%`
                                    : '0%'
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* Performance Warning */}
                {apiStatus === 'connected' && serverStats?.processing > 3 && (
                    <Alert
                        message="High Load"
                        description="Server is processing multiple requests. Your job may take longer than usual."
                        type="warning"
                        showIcon
                    />
                )}

                {/* Disconnected Warning */}
                {apiStatus === 'disconnected' && (
                    <Alert
                        message="API Server Unavailable"
                        description={
                            <div className="space-y-2">
                                <p>The Python API server is not running. Please start it:</p>
                                <pre className="bg-gray-800 text-white p-3 rounded text-sm overflow-x-auto">
                                    cd primer_optimizer<br />
                                    python run_api.py
                                </pre>
                                <p>Make sure it's running on <code>http://localhost:8000</code></p>
                            </div>
                        }
                        type="error"
                        showIcon
                    />
                )}

                {/* System Info */}
                <div className="text-xs text-gray-500 pt-4 border-t">
                    <Space direction="vertical" size={2}>
                        <div>• Maximum file size: 100MB</div>
                        <div>• Supported formats: Excel (.xlsx, .xls), CSV</div>
                        <div>• Recommended: Up to 500 primers per analysis</div>
                        <div>• Typical analysis time: 1-5 minutes per 100 primers</div>
                    </Space>
                </div>
            </div>
        </Card>
    );
}