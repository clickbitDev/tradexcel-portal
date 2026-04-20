'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { BRAND_LOGO_ALT, BRAND_LOGO_SRC, BRAND_LOGO_DARK_SRC } from '@/lib/brand';
import { useTheme } from '@/components/theme-provider';

interface BrandImageProps {
    width: number;
    height: number;
    priority?: boolean;
    src?: string;
    darkSrc?: string;
    className?: string;
    imageClassName?: string;
}

export function BrandImage({
    width,
    height,
    priority = false,
    src = BRAND_LOGO_SRC,
    darkSrc = BRAND_LOGO_DARK_SRC,
    className,
    imageClassName,
}: BrandImageProps) {
    const { theme } = useTheme();
    const [resolvedSrc, setResolvedSrc] = useState(src);

    useEffect(() => {
        if (theme === 'dark') {
            setResolvedSrc(darkSrc);
        } else if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setResolvedSrc(prefersDark ? darkSrc : src);
        } else {
            setResolvedSrc(src);
        }
    }, [theme, src, darkSrc]);

    return (
        <div className={cn('inline-flex max-w-full shrink-0 items-center', className)}>
            <Image
                src={resolvedSrc}
                alt={BRAND_LOGO_ALT}
                width={width}
                height={height}
                priority={priority}
                className={cn('block h-auto max-w-full object-contain', imageClassName)}
            />
        </div>
    );
}
