'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
    BookOpenText,
    Compass,
    Lightbulb,
    ListChecks,
    MousePointerClick,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { resolveUserGuide, shouldHideUserGuide } from '@/lib/guides/user-guides';

interface GuideSectionProps {
    title: string;
    items: string[];
    ordered?: boolean;
    icon: React.ComponentType<{ className?: string }>;
}

function GuideSection({ title, items, ordered = false, icon: Icon }: GuideSectionProps) {
    if (items.length === 0) {
        return null;
    }

    const ListTag = ordered ? 'ol' : 'ul';

    return (
        <section className="space-y-3 rounded-xl border bg-card/50 p-4">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            </div>
            <ListTag className={cn('space-y-2 pl-5 text-sm text-muted-foreground', ordered ? 'list-decimal' : 'list-disc')}>
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ListTag>
        </section>
    );
}

export function AppUserGuideOverlay() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const resolvedGuide = useMemo(() => resolveUserGuide(pathname || '/'), [pathname]);

    if (!pathname || shouldHideUserGuide(pathname)) {
        return null;
    }

    return (
        <>
            <Button
                type="button"
                onClick={() => setOpen(true)}
                className="fixed bottom-4 right-4 z-40 h-11 rounded-full px-4 shadow-lg sm:bottom-6 sm:right-6"
            >
                <BookOpenText className="h-4 w-4" />
                User guide
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-[calc(100%-1rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
                    <DialogHeader className="border-b px-6 py-5">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            <BookOpenText className="h-4 w-4" />
                            Tutorial
                        </div>
                        <DialogTitle>{resolvedGuide.guide.title}</DialogTitle>
                        <DialogDescription className="max-w-2xl text-sm leading-6">
                            {resolvedGuide.guide.overview}
                        </DialogDescription>
                        <p className="text-xs text-muted-foreground">
                            Guide path: <span className="font-mono">{resolvedGuide.matchedPattern}</span>
                        </p>
                    </DialogHeader>

                    <ScrollArea className="max-h-[75vh]">
                        <div className="space-y-4 px-6 py-5">
                            {resolvedGuide.guide.roleNote ? (
                                <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-muted-foreground">
                                    <span className="font-semibold text-foreground">Role note:</span> {resolvedGuide.guide.roleNote}
                                </div>
                            ) : null}

                            <GuideSection
                                title='What this page has'
                                items={resolvedGuide.guide.pageContains}
                                icon={Compass}
                            />
                            <GuideSection
                                title='What you can do'
                                items={resolvedGuide.guide.actions}
                                icon={MousePointerClick}
                            />
                            <GuideSection
                                title='How to use it'
                                items={resolvedGuide.guide.steps}
                                ordered
                                icon={ListChecks}
                            />
                            <GuideSection
                                title='Tips'
                                items={resolvedGuide.guide.tips || []}
                                icon={Lightbulb}
                            />
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
}
