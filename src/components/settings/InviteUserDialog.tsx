'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { UserRole } from '@/types/database';

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
    { value: 'ceo', label: 'CEO', description: 'Full admin access to all features' },
    { value: 'executive_manager', label: 'Executive Manager', description: 'Manager access with reporting' },
    { value: 'admin', label: 'Admin', description: 'Staff with admin features' },
    { value: 'accounts_manager', label: 'Accounts Manager', description: 'Finance and payments access' },
    { value: 'assessor', label: 'Assessor', description: 'Assessment workflow access' },
    { value: 'dispatch_coordinator', label: 'Dispatch Coordinator', description: 'Dispatch and logistics' },
    { value: 'frontdesk', label: 'Frontdesk', description: 'Basic operations access' },
    { value: 'developer', label: 'Developer', description: 'Full system access' },
    { value: 'agent', label: 'Agent', description: 'External partner with limited access' },
];

interface InviteUserDialogProps {
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

export function InviteUserDialog({ trigger, onSuccess }: InviteUserDialogProps) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<UserRole>('agent');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const supabase = createClient();

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            // Use Supabase Admin API to invite user
            // Note: This requires the service role key on the server side
            // For client-side, we'll use the signUp with a generated password
            // and send a password reset email

            // Generate a temporary password
            const tempPassword = crypto.randomUUID();

            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password: tempPassword,
                options: {
                    data: {
                        full_name: fullName,
                        role: role,
                    },
                    emailRedirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
                },
            });

            if (signUpError) {
                // Check if user already exists
                if (signUpError.message.includes('already registered')) {
                    setMessage({ type: 'error', text: 'A user with this email already exists' });
                } else {
                    setMessage({ type: 'error', text: signUpError.message });
                }
                setLoading(false);
                return;
            }

            // Send password reset email so the invited user can set their password
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            });

            if (resetError) {
                console.error('Error sending reset email:', resetError);
            }

            setMessage({
                type: 'success',
                text: `Invitation sent to ${email}. They will receive an email to set their password.`
            });

            // Clear form
            setEmail('');
            setFullName('');
            setRole('agent');

            // Call success callback after a delay
            setTimeout(() => {
                onSuccess?.();
            }, 2000);

        } catch {
            setMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setOpen(false);
        // Reset form state when closing
        setTimeout(() => {
            setEmail('');
            setFullName('');
            setRole('agent');
            setMessage(null);
        }, 200);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite User
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Invite New User
                    </DialogTitle>
                    <DialogDescription>
                        Send an invitation email to add a new user to the portal.
                        They&apos;ll receive a link to set their password.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleInvite}>
                    <div className="space-y-4 py-4">
                        {message && (
                            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                                {message.type === 'error' ? (
                                    <AlertCircle className="h-4 w-4" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                <AlertDescription>{message.text}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input
                                id="fullName"
                                type="text"
                                placeholder="John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="john@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{option.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {ROLE_OPTIONS.find(o => o.value === role)?.description}
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || message?.type === 'success'}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Send Invitation
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
