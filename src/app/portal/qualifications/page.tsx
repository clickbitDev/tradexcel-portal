import { createServerClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { QualificationsList } from '@/components/qualifications/QualificationsList';

export default async function QualificationsPage() {
    const supabase = await createServerClient();

    const { data: qualifications, error } = await supabase
        .from('qualifications')
        .select('*')
        .order('code');

    if (error) {
        console.error('Error fetching qualifications:', error);
    }

    return (
        <main className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Qualifications</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Browse available courses and programs ({qualifications?.length || 0} total)
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/portal/qualifications/import">
                            <Button variant="outline">
                                <Upload className="h-4 w-4 mr-2" />
                                Import CSV
                            </Button>
                        </Link>
                        <Link href="/portal/qualifications/new">
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Qualification
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <div className="p-6">
                {qualifications && qualifications.length > 0 ? (
                    <QualificationsList qualifications={qualifications} />
                ) : (
                    <Card className="p-12 text-center">
                        <GraduationCap className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-lg font-medium mb-2">No qualifications yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Add qualifications to start managing courses.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Link href="/portal/qualifications/import">
                                <Button variant="outline">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Import CSV
                                </Button>
                            </Link>
                            <Link href="/portal/qualifications/new">
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Qualification
                                </Button>
                            </Link>
                        </div>
                    </Card>
                )}
            </div>
        </main>
    );
}
