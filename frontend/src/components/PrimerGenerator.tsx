import React, { useState } from 'react';
import { Card, InputNumber, Button, Table, Space, Typography, Tooltip, Empty } from 'antd';
import { ThunderboltOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { utils, write } from 'xlsx';
import { saveAs } from 'file-saver';

const { Title, Text } = Typography;

interface GeneratedPrimer {
    id: string;
    forward: string;
    reverse: string;
    forwardTm: number;
    reverseTm: number;
    forwardGC: number;
    reverseGC: number;
}

export default function PrimerGenerator() {
    const [numPairs, setNumPairs] = useState<number>(50);
    const [primers, setPrimers] = useState<GeneratedPrimer[]>([]);

    const generateSequence = (length: number) => {
        const bases = ['A', 'T', 'C', 'G'];
        let sequence = '';
        for (let i = 0; i < length; i++) {
            sequence += bases[Math.floor(Math.random() * bases.length)];
        }
        return sequence;
    };

    const calculateTm = (sequence: string) => {
        const a = (sequence.match(/A/g) || []).length;
        const t = (sequence.match(/T/g) || []).length;
        const c = (sequence.match(/C/g) || []).length;
        const g = (sequence.match(/G/g) || []).length;
        return 2 * (a + t) + 4 * (c + g);
    };

    const calculateGC = (sequence: string) => {
        const gc = (sequence.match(/[GC]/g) || []).length;
        return (gc / sequence.length) * 100;
    };

    const handleGenerate = () => {
        const newPrimers: GeneratedPrimer[] = [];
        for (let i = 0; i < numPairs; i++) {
            const forward = generateSequence(Math.floor(Math.random() * (25 - 18 + 1)) + 18);
            const reverse = generateSequence(Math.floor(Math.random() * (25 - 18 + 1)) + 18);

            newPrimers.push({
                id: `Pair_${(i + 1).toString().padStart(3, '0')}`,
                forward,
                reverse,
                forwardTm: calculateTm(forward),
                reverseTm: calculateTm(reverse),
                forwardGC: calculateGC(forward),
                reverseGC: calculateGC(reverse),
            });
        }
        setPrimers(newPrimers);
    };

    const downloadCSV = () => {
        const header = "id,forward,reverse,forward_tm,reverse_tm,forward_gc,reverse_gc\n";
        const rows = primers.map(p =>
            `${p.id},${p.forward},${p.reverse},${p.forwardTm},${p.reverseTm},${p.forwardGC.toFixed(1)},${p.reverseGC.toFixed(1)}`
        ).join("\n");
        const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
        saveAs(blob, "generated_primers.csv");
    };

    const downloadExcel = () => {
        const ws = utils.json_to_sheet(primers.map(p => ({
            ID: p.id,
            Forward: p.forward,
            Reverse: p.reverse,
            "Forward Tm": p.forwardTm,
            "Reverse Tm": p.reverseTm,
            "Forward GC%": parseFloat(p.forwardGC.toFixed(1)),
            "Reverse GC%": parseFloat(p.reverseGC.toFixed(1))
        })));
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Primers");
        const excelBuffer = write(wb, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(data, "generated_primers.xlsx");
    };

    const downloadFasta = () => {
        let content = "";
        primers.forEach(p => {
            content += `>${p.id}_Forward\n${p.forward}\n`;
            content += `>${p.id}_Reverse\n${p.reverse}\n`;
        });
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        saveAs(blob, "generated_primers.fasta");
    };

    const columns = [
        { title: 'ID', dataIndex: 'id', key: 'id', width: 100 },
        {
            title: 'Forward',
            dataIndex: 'forward',
            key: 'forward',
            render: (text: string) => <Text code>{text}</Text>
        },
        {
            title: 'Reverse',
            dataIndex: 'reverse',
            key: 'reverse',
            render: (text: string) => <Text code>{text}</Text>
        },
        {
            title: 'Tm (°C)',
            key: 'tm',
            render: (_: any, record: GeneratedPrimer) => (
                <span>F: {record.forwardTm} / R: {record.reverseTm}</span>
            )
        },
        {
            title: 'GC (%)',
            key: 'gc',
            render: (_: any, record: GeneratedPrimer) => (
                <span>F: {record.forwardGC.toFixed(1)} / R: {record.reverseGC.toFixed(1)}</span>
            )
        },
    ];

    return (
        <div className="space-y-6">
            <Card title={
                <Space>
                    <ThunderboltOutlined />
                    <span>Generate Random Primers</span>
                </Space>
            }>
                <Space size="large" align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                        <span>Number of Pairs:</span>
                        <InputNumber
                            min={20}
                            max={500}
                            value={numPairs}
                            onChange={(val) => setNumPairs(val || 50)}
                        />
                        <Button
                            type="primary"
                            icon={<ReloadOutlined />}
                            onClick={handleGenerate}
                        >
                            Generate
                        </Button>
                    </Space>

                    {primers.length > 0 && (
                        <Space>
                            <Button icon={<DownloadOutlined />} onClick={downloadCSV}>CSV</Button>
                            <Button icon={<DownloadOutlined />} onClick={downloadExcel}>Excel</Button>
                            <Button icon={<DownloadOutlined />} onClick={downloadFasta}>FASTA</Button>
                        </Space>
                    )}
                </Space>
            </Card>

            {primers.length > 0 ? (
                <Card title={`Generated Results (${primers.length} pairs)`}>
                    <Table
                        dataSource={primers}
                        columns={columns}
                        rowKey="id"
                        pagination={{ pageSize: 10 }}
                        size="small"
                    />
                </Card>
            ) : (
                <Empty description="No primers generated yet. Click 'Generate' to start." />
            )}
        </div>
    );
}
