import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
    FileText,
    Download,
    Send,
    Trash2,
    Eye,
    Loader2,
    Plus,
    Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';

const statusConfig = {
    draft: { label: 'Draft', variant: 'secondary', icon: '📝' },
    generated: { label: 'Generated', variant: 'warning', icon: '📄' },
    sent: { label: 'Sent', variant: 'default', icon: '✉️' },
    paid: { label: 'Paid', variant: 'success', icon: '✅' },
};

export default function InvoiceList() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            const { data } = await api.get('/invoices');
            setInvoices(data.invoices);
        } catch (error) {
            console.error('Failed to fetch invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this invoice?')) return;
        setDeletingId(id);
        try {
            await api.delete(`/invoices/${id}`);
            setInvoices((prev) => prev.filter((inv) => inv._id !== id));
        } catch (error) {
            console.error('Failed to delete:', error);
        } finally {
            setDeletingId(null);
        }
    };

    const handleDownload = async (id, invoiceNumber) => {
        try {
            const response = await api.post(`/invoices/${id}/generate-pdf`, {}, {
                responseType: 'blob',
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice-${invoiceNumber || id}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            alert('PDF generation failed');
        }
    };

    const handleSend = async (id) => {
        try {
            await api.post(`/invoices/${id}/send`);
            alert('Invoice sent successfully!');
            fetchInvoices();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to send invoice');
        }
    };

    const filtered = invoices.filter((inv) => {
        const term = search.toLowerCase();
        return (
            inv.to?.name?.toLowerCase().includes(term) ||
            inv.from?.name?.toLowerCase().includes(term) ||
            inv.invoiceNumber?.toLowerCase().includes(term) ||
            inv.status?.toLowerCase().includes(term)
        );
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div>
            {/* Search and Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search invoices..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button onClick={() => navigate('/chat')} className="gap-2 shrink-0">
                    <Plus className="h-4 w-4" />
                    New Invoice
                </Button>
            </div>

            {/* Invoice List */}
            {filtered.length === 0 ? (
                <Card className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No invoices yet</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Create your first invoice by chatting with our AI assistant.
                        </p>
                        <Button onClick={() => navigate('/chat')} className="mt-2 gap-2">
                            <Plus className="h-4 w-4" />
                            Create Invoice
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {filtered.map((invoice) => {
                        const status = statusConfig[invoice.status] || statusConfig.draft;
                        const items = invoice.items || [];
                        const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
                        const tax = subtotal * ((invoice.taxRate || 0) / 100);
                        const discount = subtotal * ((invoice.discountRate || 0) / 100);
                        const total = subtotal + tax - discount;

                        return (
                            <Card
                                key={invoice._id}
                                className="p-4 hover:shadow-md transition-all duration-200 group"
                            >
                                <div className="flex items-center gap-4">
                                    {/* Icon */}
                                    <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                                        <FileText className="h-6 w-6 text-primary" />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-sm truncate">
                                                {invoice.to?.name || 'Untitled Invoice'}
                                            </h3>
                                            <Badge variant={status.variant} className="shrink-0">
                                                {status.icon} {status.label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                            {invoice.invoiceNumber && <span>#{invoice.invoiceNumber}</span>}
                                            <span>From: {invoice.from?.name || '—'}</span>
                                            <span>{formatDate(invoice.createdAt)}</span>
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <div className="text-right shrink-0">
                                        <p className="font-bold text-lg">{formatCurrency(total, invoice.currency)}</p>
                                        <p className="text-xs text-muted-foreground">{items.length} item(s)</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDownload(invoice._id, invoice.invoiceNumber)}
                                            title="Download PDF"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleSend(invoice._id)}
                                            title="Send via Email"
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(invoice._id)}
                                            disabled={deletingId === invoice._id}
                                            title="Delete"
                                        >
                                            {deletingId === invoice._id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
