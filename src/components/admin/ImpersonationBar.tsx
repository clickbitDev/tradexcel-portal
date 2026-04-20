'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, UserCheck } from 'lucide-react';

interface ImpersonationContextType {
    isImpersonating: boolean;
    impersonatedUser: { id: string; name: string; email: string } | null;
    startImpersonation: (userId: string) => Promise<void>;
    endImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
    isImpersonating: false,
    impersonatedUser: null,
    startImpersonation: async () => { },
    endImpersonation: () => { },
});

export const useImpersonation = () => useContext(ImpersonationContext);

// Session storage key for impersonation
const IMPERSONATION_KEY = 'lumiere_impersonation';

interface ImpersonationSession {
    originalAdminId: string;
    impersonatedUserId: string;
    impersonatedUserName: string;
    impersonatedUserEmail: string;
    startedAt: string;
    logId: string;
}

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<ImpersonationSession | null>(null);
    const supabase = createClient();

    // Load session from storage on mount
    useEffect(() => {
        const stored = sessionStorage.getItem(IMPERSONATION_KEY);
        if (stored) {
            try {
                setSession(JSON.parse(stored));
            } catch {
                sessionStorage.removeItem(IMPERSONATION_KEY);
            }
        }
    }, []);

    const startImpersonation = async (userId: string) => {
        // Get current admin user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get target user details
        const { data: targetProfile } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', userId)
            .single();

        if (!targetProfile) return;

        // Create impersonation log
        const { data: log } = await supabase
            .from('admin_impersonation_logs')
            .insert({
                admin_id: user.id,
                impersonated_user_id: userId,
                reason: 'Admin impersonation session started',
            })
            .select('id')
            .single();

        // Store session
        const newSession: ImpersonationSession = {
            originalAdminId: user.id,
            impersonatedUserId: userId,
            impersonatedUserName: targetProfile.full_name || 'Unknown',
            impersonatedUserEmail: targetProfile.email || '',
            startedAt: new Date().toISOString(),
            logId: log?.id || '',
        };

        sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(newSession));
        setSession(newSession);
    };

    const endImpersonation = async () => {
        if (session?.logId) {
            // Update the log with end time
            await supabase
                .from('admin_impersonation_logs')
                .update({ ended_at: new Date().toISOString() })
                .eq('id', session.logId);
        }

        sessionStorage.removeItem(IMPERSONATION_KEY);
        setSession(null);
    };

    const contextValue: ImpersonationContextType = {
        isImpersonating: !!session,
        impersonatedUser: session ? {
            id: session.impersonatedUserId,
            name: session.impersonatedUserName,
            email: session.impersonatedUserEmail,
        } : null,
        startImpersonation,
        endImpersonation,
    };

    return (
        <ImpersonationContext.Provider value={contextValue}>
            {children}
        </ImpersonationContext.Provider>
    );
}

export function ImpersonationBar() {
    const { isImpersonating, impersonatedUser, endImpersonation } = useImpersonation();

    if (!isImpersonating || !impersonatedUser) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-orange-500 text-white py-2 px-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">
                    Viewing as: {impersonatedUser.name}
                </span>
                <span className="text-orange-200">
                    ({impersonatedUser.email})
                </span>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-orange-200 text-sm">
                    <UserCheck className="h-4 w-4" />
                    <span>All actions are logged</span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={endImpersonation}
                    className="bg-white text-orange-600 hover:bg-orange-100 border-0"
                >
                    <X className="h-4 w-4 mr-2" />
                    Exit Impersonation
                </Button>
            </div>
        </div>
    );
}
