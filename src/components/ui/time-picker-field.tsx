'use client';

import { useMemo } from 'react';
import { Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TimePickerFieldProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

const HOURS = Array.from({ length: 24 }, (_, index) => index.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, '0'));

export function TimePickerField({
    value,
    onChange,
    disabled = false,
    placeholder = 'Select time',
}: TimePickerFieldProps) {
    const parsed = useMemo(() => {
        if (!/^\d{2}:\d{2}$/.test(value)) {
            return { hour: '', minute: '' };
        }

        const [hour, minute] = value.split(':');
        return { hour, minute };
    }, [value]);

    const setHour = (hour: string) => {
        onChange(`${hour}:${parsed.minute || '00'}`);
    };

    const setMinute = (minute: string) => {
        onChange(`${parsed.hour || '00'}:${minute}`);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between font-normal"
                    disabled={disabled}
                >
                    <span>{value || placeholder}</span>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-3" align="start">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Hour</p>
                        <Select value={parsed.hour} onValueChange={setHour}>
                            <SelectTrigger>
                                <SelectValue placeholder="HH" />
                            </SelectTrigger>
                            <SelectContent>
                                {HOURS.map((hour) => (
                                    <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Minute</p>
                        <Select value={parsed.minute} onValueChange={setMinute}>
                            <SelectTrigger>
                                <SelectValue placeholder="MM" />
                            </SelectTrigger>
                            <SelectContent>
                                {MINUTES.map((minute) => (
                                    <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} disabled={disabled || !value}>
                        <X className="mr-2 h-4 w-4" />
                        Clear
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
