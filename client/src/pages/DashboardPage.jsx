import AppLayout from '@/components/layout/AppLayout';
import InvoiceList from '@/components/invoice/InvoiceList';

export default function DashboardPage() {
    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">My Invoices</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your invoices, download PDFs, and send them via email.
                    </p>
                </div>
                <InvoiceList />
            </div>
        </AppLayout>
    );
}
