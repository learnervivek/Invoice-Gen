import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Download,
    Loader2,
    FileWarning,
    RefreshCw,
    Maximize2,
    Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';
import useInvoiceStore from '@/stores/useInvoiceStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a base64 string to a Blob URL for iframe embedding.
 * Returns null if the base64 string is invalid.
 */
function base64ToBlobUrl(base64, contentType = 'application/pdf') {
    try {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: contentType });
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}

/**
 * Trigger a file download from a Blob URL.
 */
function downloadFromBlobUrl(blobUrl, filename) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ─── Overlay Variants ─────────────────────────────────────────────────────────

const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
};

const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 300, damping: 25 },
    },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PdfPreviewModal({ open, onClose }) {
    const invoiceId = useInvoiceStore((s) => s.invoiceId);
    const invoiceData = useInvoiceStore((s) => s.invoiceData);

    const [loading, setLoading] = useState(false);
    const [blobUrl, setBlobUrl] = useState(null);
    const [filename, setFilename] = useState('invoice.pdf');
    const [error, setError] = useState(null);
    const [fullscreen, setFullscreen] = useState(false);

    // Clean up blob URLs on unmount or close
    useEffect(() => {
        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [blobUrl]);

    // Fetch PDF when modal opens
    const fetchPdf = useCallback(async () => {
        if (!invoiceId) {
            setError('No invoice saved yet. Save your invoice first.');
            return;
        }

        setLoading(true);
        setError(null);

        // Revoke old blob
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            setBlobUrl(null);
        }

        try {
            const { data } = await api.post(
                `/invoices/${invoiceId}/generate-pdf?format=base64`
            );

            if (!data.pdfBase64) {
                throw new Error('Server returned empty PDF data.');
            }

            const url = base64ToBlobUrl(data.pdfBase64, data.contentType || 'application/pdf');
            if (!url) {
                throw new Error('Failed to decode PDF — invalid base64 data.');
            }

            setBlobUrl(url);
            setFilename(data.filename || `invoice-${invoiceData?.invoiceNumber || invoiceId}.pdf`);
            toast.success('PDF generated!');
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'PDF generation failed.';
            setError(msg);
            toast.error('PDF generation failed', { description: msg });
        } finally {
            setLoading(false);
        }
    }, [invoiceId, invoiceData?.invoiceNumber]);

    // Fetch on open
    useEffect(() => {
        if (open) {
            fetchPdf();
            setFullscreen(false);
        }
    }, [open]);

    // Handle download
    const handleDownload = () => {
        if (blobUrl) {
            downloadFromBlobUrl(blobUrl, filename);
            toast.success('Downloading PDF', { description: filename });
        }
    };

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && open) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className={`fixed z-50 bg-background rounded-xl shadow-2xl border border-border/50 flex flex-col overflow-hidden ${fullscreen
                                ? 'inset-2'
                                : 'inset-4 sm:inset-8 md:inset-12 lg:inset-16'
                            }`}
                    >
                        {/* ── Header ───────────────────────────────────────── */}
                        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md">
                                    <span className="text-white text-[10px] font-bold">PDF</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold">Invoice Preview</h3>
                                    <p className="text-[11px] text-muted-foreground">{filename}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                {/* Download */}
                                {blobUrl && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleDownload}
                                        className="gap-1.5 text-xs"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">Download</span>
                                    </Button>
                                )}

                                {/* Retry */}
                                {error && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={fetchPdf}
                                        disabled={loading}
                                        className="gap-1.5 text-xs"
                                    >
                                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                                        Retry
                                    </Button>
                                )}

                                {/* Fullscreen */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setFullscreen(!fullscreen)}
                                >
                                    {fullscreen ? (
                                        <Minimize2 className="h-3.5 w-3.5" />
                                    ) : (
                                        <Maximize2 className="h-3.5 w-3.5" />
                                    )}
                                </Button>

                                {/* Close */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={onClose}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* ── Body ─────────────────────────────────────────── */}
                        <div className="flex-1 relative bg-gray-100 dark:bg-gray-900">
                            {/* Loading */}
                            {loading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                                    <div className="relative">
                                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20">
                                            <Loader2 className="h-8 w-8 text-white animate-spin" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-foreground">Generating PDF...</p>
                                        <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
                                    </div>
                                </div>
                            )}

                            {/* Error */}
                            {!loading && error && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
                                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-200 dark:border-red-800 flex items-center justify-center">
                                        <FileWarning className="h-8 w-8 text-red-500" />
                                    </div>
                                    <div className="text-center max-w-sm">
                                        <p className="text-sm font-semibold text-foreground">PDF Generation Failed</p>
                                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{error}</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={fetchPdf}
                                        className="gap-1.5 mt-2"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Try Again
                                    </Button>
                                </div>
                            )}

                            {/* PDF iframe */}
                            {!loading && !error && blobUrl && (
                                <iframe
                                    src={blobUrl}
                                    title="Invoice PDF Preview"
                                    className="w-full h-full border-0"
                                    style={{ minHeight: '100%' }}
                                />
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
