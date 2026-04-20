import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Mail,
    Phone,
    MessageSquare,
    HelpCircle,
    FileQuestion,
    Clock
} from 'lucide-react';

export default function AgentSupportPage() {
    return (
        <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <header className="bg-card border-b border-border px-6 py-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Support</h1>
                    <p className="text-muted-foreground mt-1">
                        Get help with your applications
                    </p>
                </div>
            </header>

            <main className="p-6 max-w-4xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Contact Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HelpCircle className="h-5 w-5 text-emerald-600" />
                                Contact Us
                            </CardTitle>
                            <CardDescription>
                                Reach out to our support team
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <Mail className="h-5 w-5 text-emerald-600" />
                                <div>
                                    <p className="font-medium">Email</p>
                                    <p className="text-sm text-muted-foreground">support@lumiere.edu.au</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <Phone className="h-5 w-5 text-emerald-600" />
                                <div>
                                    <p className="font-medium">Phone</p>
                                    <p className="text-sm text-muted-foreground">+61 2 1234 5678</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <Clock className="h-5 w-5 text-emerald-600" />
                                <div>
                                    <p className="font-medium">Business Hours</p>
                                    <p className="text-sm text-muted-foreground">Mon-Fri 9:00 AM - 5:00 PM AEST</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* FAQ */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileQuestion className="h-5 w-5 text-emerald-600" />
                                Quick Help
                            </CardTitle>
                            <CardDescription>
                                Common questions and answers
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="border-b pb-3">
                                <p className="font-medium text-sm">How do I submit a new application?</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Click &quot;New Application&quot; from the dashboard or applications page, then follow the steps.
                                </p>
                            </div>
                            <div className="border-b pb-3">
                                <p className="font-medium text-sm">What documents are required?</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Passport, visa (if applicable), academic transcripts, English test results, and a recent photo.
                                </p>
                            </div>
                            <div className="pb-3">
                                <p className="font-medium text-sm">How long does processing take?</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Typically 5-10 business days, depending on document completeness and RTO workload.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Contact Form */}
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-emerald-600" />
                            Send a Message
                        </CardTitle>
                        <CardDescription>
                            Have a specific question? Send us a message.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Input id="subject" placeholder="What is this about?" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="application">Application ID (optional)</Label>
                                    <Input id="application" placeholder="e.g., APP-790" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="message">Message</Label>
                                <Textarea
                                    id="message"
                                    placeholder="Describe your question or issue..."
                                    rows={5}
                                />
                            </div>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                                Send Message
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
