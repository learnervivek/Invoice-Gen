import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    Download,
    Send,
    Save,
    Loader2,
    CheckCircle2,
    Building2,
    User,
    Package,
    Percent,
    Truck,
    Calendar,
    DollarSign,
    Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import api from '@/lib/api';
import useInvoiceStore, { useSubtotal, useTotal, useTaxAmount, useDiscountAmount } from '@/stores/useInvoiceStore';

// ─── Currency formatter ───────────────────────────────────────────────────────

const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥',
    CAD: 'C$', AUD: 'A$', CNY: '¥', CHF: 'CHF', SGD: 'S$',
    BRL: 'R$', MXN: 'MX$', AED: 'د.إ',
};

function formatCurrency(amount, currency = 'USD') {
    const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
    return `${symbol}${amount.toFixed(2)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoiceSummaryCard({ onEdit }) {
    const invoiceData = useInvoiceStore((s) => s.invoiceData);
    const invoiceId = useInvoiceStore((s) => s.invoiceId);
    const setInvoiceId = useInvoiceStore((s) => s.setInvoiceId);

    const subtotal = useSubtotal();
    const total = useTotal();
    const taxAmount = useTaxAmount();
    const discountAmount = useDiscountAmount();

    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [emailing, setEmailing] = useState(false);
    const [savedId, setSavedId] = useState(null);

    const { from, to, items, taxRate, discountRate, shipping, currency, dueDate } = invoiceData;
    const effectiveId = invoiceId || savedId;

    // ── Save Draft ────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            let res;
            if (effectiveId) {
                res = await api.put(`/invoices/${effectiveId}`, invoiceData);
            } else {
                res = await api.post('/invoices', invoiceData);
            }
            const id = res.data._id || res.data.invoice?._id;
            if (id) {
                setInvoiceId(id);
                setSavedId(id);
            }
            toast.success('Invoice saved!', { description: `ID: ${id}` });
            return id;
        } catch (err) {
            const data = err.response?.data;
            const details = data?.errors?.map(e => `${e.field}: ${e.message}`).join(', ') || data?.message || err.message;
            toast.error('Save failed', { description: details });
            return null;
        } finally {
            setSaving(false);
        }
    };

    // ── Generate PDF ──────────────────────────────────────────────────────────
    const handleGeneratePDF = async () => {
        let id = effectiveId || savedId;
        if (!id) {
            toast.info('Saving invoice first...');
            id = await handleSave();
        }
        if (!id) return;

        setGenerating(true);
        try {
            const { data } = await api.post(`/invoices/${id}/generate-pdf`, {}, {
                responseType: 'blob',
            });
            const blob = new Blob([data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice-${invoiceData.invoiceNumber || id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('PDF downloaded!');
        } catch (err) {
            toast.error('PDF generation failed', { description: err.response?.data?.message || err.message });
        } finally {
            setGenerating(false);
        }
    };

    // ── Email Invoice ─────────────────────────────────────────────────────────
    const handleEmail = async () => {
        let id = effectiveId || savedId;
        if (!id) {
            toast.info('Saving invoice first...');
            id = await handleSave();
        }
        if (!id) return;

        if (!to?.email) {
            toast.error('No recipient email', { description: 'Customer email is required to send.' });
            return;
        }

        setEmailing(true);
        try {
            await api.post(`/invoices/${id}/send`, {});
            toast.success('Invoice sent!', { description: `Emailed to ${to.email}` });
        } catch (err) {
            toast.error('Email failed', { description: err.response?.data?.message || err.message });
        } finally {
            setEmailing(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className="w-full max-w-md rounded-xl border border-border/60 bg-gradient-to-b from-background to-muted/20 shadow-xl overflow-hidden"
        >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b border-border/40">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                            <FileText className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold">Invoice Summary</h3>
                            <p className="text-[10px] text-muted-foreground">Ready for review</p>
                        </div>
                    </div>
                    {onEdit && (
                        <Button variant="ghost" size="sm" onClick={onEdit} className="gap-1 text-xs h-7">
                            <Pencil className="h-3 w-3" />
                            Edit
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Details ────────────────────────────────────────────────── */}
            <div className="px-4 py-3 space-y-3 text-xs">
                {/* From / To */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground font-medium">
                            <Building2 className="h-3 w-3" /> From
                        </div>
                        <p className="font-semibold text-foreground">{from?.name || '—'}</p>
                        <p className="text-muted-foreground text-[11px] leading-snug">{from?.address || '—'}</p>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground font-medium">
                            <User className="h-3 w-3" /> To
                        </div>
                        <p className="font-semibold text-foreground">{to?.name || '—'}</p>
                        <p className="text-muted-foreground text-[11px] leading-snug">{to?.address || '—'}</p>
                        {to?.email && (
                            <p className="text-muted-foreground text-[11px]">{to.email}</p>
                        )}
                    </div>
                </div>

                <Separator />

                {/* Items */}
                <div>
                    <div className="flex items-center gap-1 text-muted-foreground font-medium mb-1.5">
                        <Package className="h-3 w-3" /> Items ({items?.length || 0})
                    </div>
                    <div className="space-y-1">
                        {(items || []).map((item, i) => (
                            <div key={i} className="flex items-center justify-between py-1 px-2 rounded bg-muted/30">
                                <div>
                                    <span className="font-medium text-foreground">{item.name}</span>
                                    {item.description && (
                                        <span className="text-muted-foreground ml-1">({item.description})</span>
                                    )}
                                </div>
                                <div className="text-right font-mono text-[11px]">
                                    {item.quantity} × {formatCurrency(item.unit_cost, currency)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-1.5">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="font-mono">{formatCurrency(subtotal, currency)}</span>
                    </div>
                    {taxRate > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Percent className="h-3 w-3" /> Tax ({taxRate}%)
                            </span>
                            <span className="font-mono text-amber-600">+{formatCurrency(taxAmount, currency)}</span>
                        </div>
                    )}
                    {discountRate > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Discount ({discountRate}%)</span>
                            <span className="font-mono text-green-600">-{formatCurrency(discountAmount, currency)}</span>
                        </div>
                    )}
                    {shipping > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Truck className="h-3 w-3" /> Shipping
                            </span>
                            <span className="font-mono">+{formatCurrency(shipping, currency)}</span>
                        </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-sm pt-1">
                        <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" /> Grand Total
                        </span>
                        <span className="font-mono text-blue-600">{formatCurrency(total, currency)}</span>
                    </div>
                </div>

                {/* Due date */}
                {dueDate && (
                    <div className="flex items-center gap-1.5 text-muted-foreground pt-1">
                        <Calendar className="h-3 w-3" />
                        <span>Due: <strong className="text-foreground">{dueDate}</strong></span>
                    </div>
                )}
            </div>

            {/* ── Action Buttons ──────────────────────────────────────────── */}
            <div className="px-4 py-3 border-t bg-muted/10 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSave}
                        disabled={saving || generating || emailing}
                        className="gap-1.5 text-xs h-9"
                    >
                        {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : effectiveId ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                            <Save className="h-3.5 w-3.5" />
                        )}
                        {saving ? '...' : effectiveId ? 'Saved' : 'Save'}
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGeneratePDF}
                        disabled={saving || generating || emailing}
                        className="gap-1.5 text-xs h-9"
                    >
                        {generating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Download className="h-3.5 w-3.5" />
                        )}
                        {generating ? '...' : 'PDF'}
                    </Button>

                    <Button
                        size="sm"
                        onClick={handleEmail}
                        disabled={saving || generating || emailing || !to?.email}
                        className="gap-1.5 text-xs h-9 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                    >
                        {emailing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Send className="h-3.5 w-3.5" />
                        )}
                        {emailing ? '...' : 'Email'}
                    </Button>
                </div>

                {!to?.email && (
                    <p className="text-[10px] text-amber-500 text-center">
                        ⚠️ Customer email required to send
                    </p>
                )}
            </div>
        </motion.div>
    );
}
