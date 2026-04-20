'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ComplianceExportButtonProps {
    csvData: string;
    fromDate: string;
    toDate: string;
}

export default function ComplianceExportButton({ csvData, fromDate, toDate }: ComplianceExportButtonProps) {
    const handleDownload = () => {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `compliance-report-${fromDate}-to-${toDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <Button onClick={handleDownload} className="bg-primary">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
        </Button>
    );
}
