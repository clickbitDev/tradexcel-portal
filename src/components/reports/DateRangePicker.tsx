'use client';

import { useState, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DateRange, DateRangePreset, getDateRangeFromPreset } from '@/lib/report-utils';

interface DateRangePickerProps {
    dateRange: DateRange;
    onDateRangeChange: (range: DateRange) => void;
    className?: string;
}

const presets: { label: string; value: DateRangePreset }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Last 7 days', value: 'last7days' },
    { label: 'Last 30 days', value: 'last30days' },
    { label: 'Last 90 days', value: 'last90days' },
    { label: 'This Month', value: 'thisMonth' },
    { label: 'Last Month', value: 'lastMonth' },
    { label: 'This Year', value: 'thisYear' },
];

export function DateRangePicker({ dateRange, onDateRangeChange, className }: DateRangePickerProps) {
    const [open, setOpen] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<DateRangePreset | null>(dateRange.preset || 'last30days');

    const handlePresetClick = useCallback((preset: DateRangePreset) => {
        setSelectedPreset(preset);
        const newRange = getDateRangeFromPreset(preset);
        onDateRangeChange(newRange);
    }, [onDateRangeChange]);

    const handleDateSelect = useCallback((range: { from?: Date; to?: Date } | undefined) => {
        if (range?.from) {
            setSelectedPreset('custom');
            onDateRangeChange({
                from: range.from,
                to: range.to || range.from,
                preset: 'custom',
            });
        }
    }, [onDateRangeChange]);

    const formatDateRange = () => {
        if (selectedPreset && selectedPreset !== 'custom') {
            const preset = presets.find(p => p.value === selectedPreset);
            return preset?.label || 'Select date range';
        }
        return `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        'justify-start text-left font-normal min-w-[240px]',
                        !dateRange.from && 'text-muted-foreground',
                        className
                    )}
                >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formatDateRange()}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="flex">
                    {/* Presets sidebar */}
                    <div className="border-r p-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Quick Select</p>
                        {presets.map((preset) => (
                            <Button
                                key={preset.value}
                                variant={selectedPreset === preset.value ? 'secondary' : 'ghost'}
                                size="sm"
                                className="w-full justify-start text-sm"
                                onClick={() => handlePresetClick(preset.value)}
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>

                    {/* Calendar */}
                    <div className="p-3">
                        <CalendarComponent
                            mode="range"
                            defaultMonth={dateRange.from}
                            selected={{
                                from: dateRange.from,
                                to: dateRange.to,
                            }}
                            onSelect={handleDateSelect}
                            numberOfMonths={2}
                        />
                    </div>
                </div>

                <div className="border-t p-3 flex justify-end">
                    <Button size="sm" onClick={() => setOpen(false)}>
                        Apply
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
