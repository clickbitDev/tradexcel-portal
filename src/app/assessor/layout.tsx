import { redirect } from 'next/navigation';

export default function AssessorRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    void children;
    redirect('/portal/assessor');
}
