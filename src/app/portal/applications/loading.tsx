'use client';

import { Loader2, FileText } from 'lucide-react';

export default function ApplicationsLoading() {
    return (
        <main className="flex-1 overflow-y-auto">
            <header className="bg-card border-b border-border px-4 md:px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl md:text-2xl font-semibold text-foreground">Applications</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Loading applications...
                        </p>
                    </div>
                </div>
            </header>
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <FileText className="h-12 w-12 text-muted-foreground/30" />
                        <Loader2 className="h-6 w-6 animate-spin text-primary absolute -bottom-1 -right-1" />
                    </div>
                    <p className="text-sm text-muted-foreground">Loading applications...</p>
                </div>
            </div>
        </main>
    );
}
