import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

export default function SettingsForbidden() {
    return (
        <main className="flex flex-1 items-center justify-center px-6 py-10">
            <Card className="w-full max-w-xl">
                <CardHeader className="space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle>403: Settings access is restricted</CardTitle>
                        <CardDescription>
                            Only CEO and developer accounts can access portal settings.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        This area controls system-wide configuration. Use your assigned workstation for your day-to-day tasks.
                    </p>
                    <Link href="/portal">
                        <Button variant="outline">Back to Portal</Button>
                    </Link>
                </CardContent>
            </Card>
        </main>
    );
}
