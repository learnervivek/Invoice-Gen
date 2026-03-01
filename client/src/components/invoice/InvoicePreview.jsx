import { useMemo, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import {
    Download,
    Send,
    FileText,
    CalendarDays,
    Building2,
    Mail,
    MapPin,
    Phone,
    Hash,
    Truck,
    Loader2,
    Sparkles,
    Eye,
} from 'lucide-react';
import api from '@/lib/api';
import useInvoiceStore, { useSubtotal, useTotal, useTaxAmount, useDiscountAmount } from '@/stores/useInvoiceStore';
import PdfPreviewModal from './PdfPreviewModal';

// ─── Currency Formatter ───────────────────────────────────────────────────────

const CURRENCY_MAP = {
    USD: { locale: 'en-US', code: 'USD' },
    EUR: { locale: 'de-DE', code: 'EUR' },
    GBP: { locale: 'en-GB', code: 'GBP' },
    INR: { locale: 'en-IN', code: 'INR' },
    CAD: { locale: 'en-CA', code: 'CAD' },
    AUD: { locale: 'en-AU', code: 'AUD' },
    JPY: { locale: 'ja-JP', code: 'JPY' },
    CNY: { locale: 'zh-CN', code: 'CNY' },
    CHF: { locale: 'de-CH', code: 'CHF' },
    SGD: { locale: 'en-SG', code: 'SGD' },
    BRL: { locale: 'pt-BR', code: 'BRL' },
    MXN: { locale: 'es-MX', code: 'MXN' },
    AED: { locale: 'ar-AE', code: 'AED' },
};

const fmt = (amount, currency = 'USD') => {
    const conf = CURRENCY_MAP[currency] || CURRENCY_MAP.USD;
    try {
        return new Intl.NumberFormat(conf.locale, {
            style: 'currency',
            currency: conf.code,
            minimumFractionDigits: conf.code === 'JPY' ? 0 : 2,
            maximumFractionDigits: conf.code === 'JPY' ? 0 : 2,
        }).format(amount || 0);
    } catch {
        return `$${(amount || 0).toFixed(2)}`;
    }
};

// ─── Status Configuration ─────────────────────────────────────────────────────

const STATUS_CONFIG = {
    draft: {
        label: 'Draft',
        color: 'bg-slate-100 text-slate-700 border border-slate-200',
        dot: 'bg-slate-400',
    },
    generated: {
        label: 'Generated',
        color: 'bg-amber-50 text-amber-700 border border-amber-200',
        dot: 'bg-amber-400',
    },
    sent: {
        label: 'Sent',
        color: 'bg-blue-50 text-blue-700 border border-blue-200',
        dot: 'bg-blue-400',
    },
    paid: {
        label: 'Paid',
        color: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        dot: 'bg-emerald-400',
    },
};

// ─── Contact Block ────────────────────────────────────────────────────────────

function ContactBlock({ label, data, icon: Icon, delay = 0 }) {
    return (
        <div
            className="invoice-fade-in space-y-2 p-4 rounded-xl bg-gray-50/70 border border-gray-100/80"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="flex items-center gap-1.5 mb-2.5">
                <div className="h-5 w-5 rounded-md bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                    <Icon className="h-2.5 w-2.5 text-gray-400" />
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em]">
                    {label}
                </p>
            </div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">
                {data?.name || '—'}
            </p>
            {data?.email && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Mail className="h-3 w-3 shrink-0 text-gray-400" />
                    <span className="truncate">{data.email}</span>
                </div>
            )}
            {data?.address && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
                    <span>{data.address}</span>
                </div>
            )}
            {data?.phone && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Phone className="h-3 w-3 shrink-0 text-gray-400" />
                    <span>{data.phone}</span>
                </div>
            )}
        </div>
    );
}

// ─── Totals Row ───────────────────────────────────────────────────────────────

function TotalsRow({ label, value, currency, prefix = '', bold = false, icon: Icon = null }) {
    return (
        <div
            className={`flex justify-between items-center py-1.5 ${bold
                ? 'text-base font-bold text-gray-900'
                : 'text-sm text-gray-500'
                }`}
        >
            <span className="flex items-center gap-1.5">
                {Icon && <Icon className="h-3 w-3 text-gray-400" />}
                {label}
            </span>
            <span className="tabular-nums font-medium">
                {prefix}
                {fmt(value, currency)}
            </span>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoicePreview() {
    // ── Zustand store ────────────────────────────────────────────────────────
    const invoiceData = useInvoiceStore((s) => s.invoiceData);
    const invoiceId = useInvoiceStore((s) => s.invoiceId);

    const [downloading, setDownloading] = useState(false);
    const [sending, setSending] = useState(false);
    const [showPdfPreview, setShowPdfPreview] = useState(false);

    // ── Derived state from store selectors (optimized re-renders) ────────────
    const subtotal = useSubtotal();
    const total = useTotal();
    const taxAmount = useTaxAmount();
    const discountAmount = useDiscountAmount();

    const totals = useMemo(() => ({
        subtotal: Math.round(subtotal * 100) / 100,
        taxRate: invoiceData?.taxRate || 0,
        taxAmount: Math.round(taxAmount * 100) / 100,
        discountRate: invoiceData?.discountRate || 0,
        discountAmount: Math.round(discountAmount * 100) / 100,
        shipping: Math.round((invoiceData?.shipping || 0) * 100) / 100,
        total: Math.round(total * 100) / 100,
        itemCount: (invoiceData?.items || []).length,
    }), [subtotal, total, taxAmount, discountAmount, invoiceData?.taxRate, invoiceData?.discountRate, invoiceData?.shipping, invoiceData?.items]);

    const currency = invoiceData?.currency || 'USD';
    const items = invoiceData?.items || [];
    const status = STATUS_CONFIG[invoiceData?.status] || STATUS_CONFIG.draft;
    const hasData =
        invoiceData?.from?.name || invoiceData?.to?.name || items.length > 0;

    // ── PDF Download ─────────────────────────────────────────────────────────
    const handleDownloadPDF = async () => {
        if (!invoiceId) return;
        setDownloading(true);
        try {
            const response = await api.post(
                `/invoices/${invoiceId}/generate-pdf`,
                {},
                { responseType: 'blob' }
            );
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice-${invoiceData?.invoiceNumber || invoiceId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('PDF download failed:', error);
        } finally {
            setDownloading(false);
        }
    };

    // ── Email Send ───────────────────────────────────────────────────────────
    const handleSendEmail = async () => {
        if (!invoiceId) return;
        setSending(true);
        try {
            await api.post(`/invoices/${invoiceId}/send`);
            alert('Invoice sent successfully!');
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to send invoice');
        } finally {
            setSending(false);
        }
    };

    // ── Empty State ──────────────────────────────────────────────────────────
    if (!hasData) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="relative mb-8 invoice-float">
                    <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-primary/12 via-primary/8 to-blue-500/5 flex items-center justify-center border border-primary/10 shadow-lg shadow-primary/5">
                        <FileText className="h-14 w-14 text-primary/25" strokeWidth={1.5} />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-400/10 border border-amber-200/30 flex items-center justify-center shadow-md">
                        <Sparkles className="h-5 w-5 text-amber-500/60" />
                    </div>
                    <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-emerald-400/15 border border-emerald-300/20" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">
                    Live Invoice Preview
                </h3>
                <p className="text-sm text-muted-foreground max-w-[320px] leading-relaxed">
                    Start chatting with the assistant to build your invoice.
                    Every detail you add will appear here instantly.
                </p>
                <div className="flex items-center gap-5 mt-8">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        Real-time updates
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" style={{ animationDelay: '500ms' }} />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                        </span>
                        Auto-calculated
                    </span>
                </div>
            </div>
        );
    }

    // ── Main Preview ─────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full">
            {/* ── Glassmorphism Action Bar ──────────────────────────────────── */}
            {invoiceId && (
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-white/70 dark:bg-background/70 backdrop-blur-xl sticky top-0 z-10">
                    <div className="flex items-center gap-2.5">
                        <div
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${status.color}`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                        </div>
                        {invoiceData?.invoiceNumber && (
                            <span className="text-xs text-muted-foreground font-medium">
                                #{invoiceData.invoiceNumber}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDownloadPDF}
                            disabled={downloading}
                            className="gap-1.5 h-8 text-xs font-medium rounded-lg hover:shadow-sm transition-all"
                        >
                            {downloading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Download className="h-3.5 w-3.5" />
                            )}
                            {downloading ? 'Generating...' : 'PDF'}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowPdfPreview(true)}
                            className="gap-1.5 h-8 text-xs font-medium rounded-lg hover:shadow-sm transition-all"
                        >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSendEmail}
                            disabled={sending}
                            className="gap-1.5 h-8 text-xs font-medium rounded-lg shadow-sm hover:shadow-md transition-all"
                        >
                            {sending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Send className="h-3.5 w-3.5" />
                            )}
                            {sending ? 'Sending...' : 'Email'}
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Invoice Document ────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 lg:p-8 bg-gradient-to-b from-muted/30 via-muted/15 to-transparent">
                <div className="invoice-preview rounded-2xl max-w-[680px] mx-auto border border-gray-100 overflow-hidden">
                    {/* ── Gradient Accent Strip ──────────────────────────────── */}
                    <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

                    <div className="p-5 sm:p-6 md:p-8 lg:p-10">
                        {/* ── Header ─────────────────────────────────────────── */}
                        <div
                            className="invoice-fade-in flex flex-col sm:flex-row items-start justify-between gap-4 mb-8 pb-6 border-b border-gray-100"
                            style={{ animationDelay: '0ms' }}
                        >
                            <div>
                                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-none">
                                    INVOICE
                                </h1>
                                {invoiceData?.invoiceNumber && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                        <Hash className="h-3.5 w-3.5 text-gray-300" />
                                        <span className="text-sm text-gray-400 font-medium tracking-wide">
                                            {invoiceData.invoiceNumber}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="text-left sm:text-right space-y-1.5">
                                {invoiceData?.issueDate && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 sm:justify-end">
                                        <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                                        <span className="font-medium">
                                            Issued {formatDate(invoiceData.issueDate)}
                                        </span>
                                    </div>
                                )}
                                {invoiceData?.dueDate && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 sm:justify-end">
                                        <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                                        <span className="font-medium">
                                            Due {formatDate(invoiceData.dueDate)}
                                        </span>
                                    </div>
                                )}
                                {!invoiceData?.issueDate && !invoiceData?.dueDate && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 sm:justify-end">
                                        <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                                        <span className="font-medium">
                                            Issued {formatDate(new Date())}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Sender / Recipient ─────────────────────────────── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                            <ContactBlock
                                label="From"
                                data={invoiceData?.from}
                                icon={Building2}
                                delay={80}
                            />
                            <ContactBlock
                                label="Bill To"
                                data={invoiceData?.to}
                                icon={Building2}
                                delay={160}
                            />
                        </div>

                        {/* ── Items Table ────────────────────────────────────── */}
                        <div
                            className="invoice-fade-in mb-8"
                            style={{ animationDelay: '240ms' }}
                        >
                            <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                                {/* Table Header */}
                                <div className="grid grid-cols-12 gap-2 px-4 sm:px-5 py-3 bg-gradient-to-r from-gray-50 to-gray-50/80 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                    <div className="col-span-1">#</div>
                                    <div className="col-span-5">Description</div>
                                    <div className="col-span-2 text-center">Qty</div>
                                    <div className="col-span-2 text-right">Rate</div>
                                    <div className="col-span-2 text-right">Amount</div>
                                </div>

                                {/* Table Body */}
                                {items.length > 0 ? (
                                    items.map((item, i) => {
                                        const lineAmount =
                                            (item.quantity || 0) * (item.unit_cost || 0);
                                        return (
                                            <div
                                                key={i}
                                                className={`grid grid-cols-12 gap-2 px-4 sm:px-5 py-3.5 border-t border-gray-50 text-sm items-center transition-all duration-200 hover:bg-blue-50/30 ${i % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'
                                                    }`}
                                            >
                                                <div className="col-span-1">
                                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-gray-100 text-[10px] font-bold text-gray-400">
                                                        {i + 1}
                                                    </span>
                                                </div>
                                                <div className="col-span-5">
                                                    <p className="font-semibold text-gray-900 text-sm leading-tight">
                                                        {item.name || '—'}
                                                    </p>
                                                    {item.description && (
                                                        <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                                                            {item.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="col-span-2 text-center text-gray-600 tabular-nums font-medium">
                                                    {item.quantity || 0}
                                                </div>
                                                <div className="col-span-2 text-right text-gray-500 tabular-nums">
                                                    {fmt(item.unit_cost, currency)}
                                                </div>
                                                <div className="col-span-2 text-right font-bold text-gray-900 tabular-nums">
                                                    {fmt(lineAmount, currency)}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="px-5 py-10 text-center border-t border-gray-50">
                                        <FileText className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                        <p className="text-sm text-gray-400">
                                            No items added yet.
                                        </p>
                                        <p className="text-xs text-gray-300 mt-0.5">
                                            Tell the assistant what you'd like to invoice.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Totals ─────────────────────────────────────────── */}
                        <div
                            className="invoice-fade-in flex justify-end mb-8"
                            style={{ animationDelay: '320ms' }}
                        >
                            <div className="w-full sm:w-80 space-y-1">
                                <TotalsRow
                                    label="Subtotal"
                                    value={totals.subtotal}
                                    currency={currency}
                                />

                                {totals.discountRate > 0 && (
                                    <TotalsRow
                                        label={`Discount (${totals.discountRate}%)`}
                                        value={totals.discountAmount}
                                        currency={currency}
                                        prefix="−"
                                    />
                                )}

                                {totals.taxRate > 0 && (
                                    <TotalsRow
                                        label={`Tax (${totals.taxRate}%)`}
                                        value={totals.taxAmount}
                                        currency={currency}
                                        prefix="+"
                                    />
                                )}

                                {totals.shipping > 0 && (
                                    <TotalsRow
                                        label="Shipping"
                                        value={totals.shipping}
                                        currency={currency}
                                        prefix="+"
                                        icon={Truck}
                                    />
                                )}

                                {/* ── Grand Total ──────────────────────────────── */}
                                <div className="pt-3 mt-2">
                                    <Separator className="bg-gray-200 mb-3" />
                                    <div className="flex justify-between items-center p-3 -mx-3 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800">
                                        <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                                            Total Due
                                        </span>
                                        <span className="text-2xl font-extrabold text-white tabular-nums tracking-tight invoice-total-pulse">
                                            {fmt(totals.total, currency)}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 text-right mt-2 font-medium">
                                        {currency} • {totals.itemCount} item
                                        {totals.itemCount !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Notes & Terms ──────────────────────────────────── */}
                        {(invoiceData?.notes || invoiceData?.terms) && (
                            <div
                                className="invoice-fade-in border-t border-gray-100 pt-6 space-y-5"
                                style={{ animationDelay: '400ms' }}
                            >
                                {invoiceData.notes && (
                                    <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/50">
                                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.14em] mb-1.5">
                                            Notes
                                        </p>
                                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                            {invoiceData.notes}
                                        </p>
                                    </div>
                                )}
                                {invoiceData.terms && (
                                    <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-100/50">
                                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.14em] mb-1.5">
                                            Terms & Conditions
                                        </p>
                                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                            {invoiceData.terms}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Footer ─────────────────────────────────────────── */}
                        <div className="mt-10 pt-5 border-t border-gray-50 text-center">
                            <p className="text-[10px] text-gray-300 font-semibold tracking-widest uppercase">
                                Generated with InvoiceGen
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* PDF Preview Modal */}
            <PdfPreviewModal
                open={showPdfPreview}
                onClose={() => setShowPdfPreview(false)}
            />
        </div>
    );
}
