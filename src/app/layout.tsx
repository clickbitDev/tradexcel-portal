import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { ChunkErrorHandler } from "@/components/chunk-error-handler";
import { AccessControlProvider } from '@/components/access-control/AccessControlProvider';
import { ReduxProvider } from '@/components/providers/ReduxProvider';
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppUserGuideOverlay } from '@/components/guides/AppUserGuideOverlay';
import { RuntimePublicEnvScript } from '@/components/runtime-public-env-script';
import { BRAND_METADATA_DESCRIPTION, BRAND_METADATA_TITLE, BRAND_THEME_STORAGE_KEY } from '@/lib/brand';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: BRAND_METADATA_TITLE,
  description: BRAND_METADATA_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className="font-sans antialiased">
        <RuntimePublicEnvScript />
        <ErrorBoundary>
          <ChunkErrorHandler />
          <ThemeProvider defaultTheme="system" storageKey={BRAND_THEME_STORAGE_KEY}>
            <ReduxProvider>
              <AccessControlProvider>
                <TooltipProvider>
                  {children}
                  <AppUserGuideOverlay />
                  <Toaster richColors position="top-right" closeButton />
                </TooltipProvider>
              </AccessControlProvider>
            </ReduxProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
