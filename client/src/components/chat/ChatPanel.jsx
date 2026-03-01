import { useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage from './ChatMessage';
import InvoiceSummaryCard from './InvoiceSummaryCard';
import {
    Send,
    Loader2,
    Sparkles,
    DollarSign,
    Percent,
    ChevronDown,
    ChevronUp,
    Eye,
    Undo2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '@/lib/api';
import useInvoiceStore from '@/stores/useInvoiceStore';
import useChatStore from '@/stores/useChatStore';
import useFlowEngine from '@/hooks/useFlowEngine';

// ─── Chip animation variants ─────────────────────────────────────────────────

const chipVariants = {
    initial: { scale: 0.9, opacity: 0 },
    animate: (i) => ({
        scale: 1,
        opacity: 1,
        transition: { delay: i * 0.03, type: 'spring', stiffness: 400, damping: 25 },
    }),
    tap: { scale: 0.93 },
};

export default function ChatPanel({ onTogglePreview }) {
    // ── Zustand stores ───────────────────────────────────────────────────────
    const invoiceData = useInvoiceStore((s) => s.invoiceData);
    const invoiceId = useInvoiceStore((s) => s.invoiceId);
    const setInvoiceId = useInvoiceStore((s) => s.setInvoiceId);
    const undo = useInvoiceStore((s) => s.undo);
    const canUndo = useInvoiceStore((s) => s.history.length > 0);

    const messages = useChatStore((s) => s.messages);
    const input = useChatStore((s) => s.input);
    const loading = useChatStore((s) => s.loading);
    const chipsExpanded = useChatStore((s) => s.chipsExpanded);
    const flowStarted = useChatStore((s) => s.flowStarted);
    const addMessage = useChatStore((s) => s.addMessage);
    const setInput = useChatStore((s) => s.setInput);
    const setLoading = useChatStore((s) => s.setLoading);
    const toggleChips = useChatStore((s) => s.toggleChips);
    const setFlowStarted = useChatStore((s) => s.setFlowStarted);

    // ── Flow engine ──────────────────────────────────────────────────────────
    const { processInput, getContextChips, currentStep, totalSteps, isComplete, STEPS } = useFlowEngine();

    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                setTimeout(() => {
                    viewport.scrollTop = viewport.scrollHeight;
                }, 100);
            }
        }
    }, [messages]);

    // Focus input
    useEffect(() => {
        inputRef.current?.focus();
    }, [loading]);

    // ── Auto-post first question on mount ────────────────────────────────────
    useEffect(() => {
        if (!flowStarted) {
            const firstStep = STEPS[0];
            if (firstStep) {
                addMessage({ role: 'bot', message: firstStep.question });
                setFlowStarted(true);
            }
        }
    }, [flowStarted, addMessage, setFlowStarted, STEPS]);

    // ── Save invoice via API ─────────────────────────────────────────────────
    const saveInvoice = useCallback(async () => {
        setLoading(true);
        try {
            let response;
            if (invoiceId) {
                response = await api.put(`/invoices/${invoiceId}`, invoiceData);
            } else {
                response = await api.post('/invoices', invoiceData);
            }
            const savedId = response.data._id || response.data.invoice?._id;
            if (savedId) setInvoiceId(savedId);
            addMessage({ role: 'bot', message: '💾 **Invoice saved successfully!**\n\nYou can now generate a PDF or send it via email from the preview panel.' });
            toast.success('Invoice saved!', {
                description: `Invoice #${invoiceData.invoiceNumber || savedId}`,
            });
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Failed to save invoice.';
            addMessage({ role: 'bot', message: `❌ Error saving: ${errorMsg}` });
            toast.error('Save failed', { description: errorMsg });
        } finally {
            setLoading(false);
        }
    }, [invoiceId, invoiceData, setLoading, setInvoiceId, addMessage]);

    // ── Process user input through flow engine ───────────────────────────────
    const sendMessage = useCallback((overrideMessage) => {
        const trimmed = (overrideMessage || input).trim();
        if (!trimmed || loading) return;

        // Add user message
        addMessage({ role: 'user', message: trimmed });
        if (!overrideMessage) setInput('');

        // Process through flow engine
        const result = processInput(trimmed);

        // Handle save request (delegate to API)
        if (result.saveRequested) {
            saveInvoice();
            return;
        }

        // Add bot response
        if (result.botMessage) {
            // Small delay for natural feel
            setLoading(true);
            setTimeout(() => {
                addMessage({ role: 'bot', message: result.botMessage });
                setLoading(false);
            }, 300);
        }
    }, [input, loading, addMessage, setInput, setLoading, processInput, saveInvoice]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleChipClick = (chip) => {
        sendMessage(chip.value);
    };

    const handleUndo = () => {
        const didUndo = undo();
        if (didUndo) {
            toast.info('Undone', { description: 'Reverted to previous state.' });
        } else {
            toast.warning('Nothing to undo');
        }
    };

    // ── Dynamic context chips from flow engine ───────────────────────────────
    const contextChips = getContextChips();

    // ── Progress indicator ───────────────────────────────────────────────────
    const progress = Math.min((currentStep / (totalSteps - 1)) * 100, 100);

    return (
        <div className="flex flex-col h-full">
            {/* ── Chat Header ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-gradient-to-r from-background to-muted/30">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                        <div className="absolute inset-0 h-3 w-3 rounded-full bg-emerald-500 animate-ping opacity-40" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold">Invoice Assistant</h3>
                        <p className="text-[11px] text-muted-foreground">
                            Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={handleUndo}
                        disabled={!canUndo}
                        title="Undo last change"
                    >
                        <Undo2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Undo</span>
                    </Button>

                    {onTogglePreview && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="lg:hidden gap-1.5 text-xs"
                            onClick={onTogglePreview}
                        >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Progress Bar ──────────────────────────────────────────── */}
            <div className="h-1 bg-muted/30">
                <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                />
            </div>

            {/* ── Quick Chips (context-aware) ────────────────────────────── */}
            {contextChips.length > 0 && (
                <div className="border-b bg-muted/10">
                    <div className="flex items-center justify-between px-3 pt-2">
                        <div className="flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-primary" />
                            <span className="text-[11px] font-medium text-muted-foreground">Quick answers</span>
                        </div>
                        <button
                            onClick={toggleChips}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {chipsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                    </div>

                    <AnimatePresence>
                        {chipsExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <div className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none">
                                    {contextChips.map((chip, i) => (
                                        <motion.button
                                            key={chip.label}
                                            custom={i}
                                            variants={chipVariants}
                                            initial="initial"
                                            animate="animate"
                                            whileTap="tap"
                                            onClick={() => handleChipClick(chip)}
                                            disabled={loading}
                                            className="shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full border border-border/50 bg-background hover:bg-primary/5 hover:border-primary/30 hover:text-primary text-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {chip.label}
                                        </motion.button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* ── Messages ──────────────────────────────────────────────── */}
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
                <div className="space-y-4 pb-4">
                    {messages.map((msg, i) => (
                        <ChatMessage
                            key={i}
                            message={msg.message}
                            isBot={msg.role === 'bot'}
                            index={i}
                        />
                    ))}
                    {/* Invoice summary card when flow completes */}
                    {isComplete && (
                        <InvoiceSummaryCard
                            onEdit={() => sendMessage('edit company name')}
                        />
                    )}
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-3"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25">
                                <Loader2 className="h-4 w-4 text-white animate-spin" />
                            </div>
                            <div className="bg-muted/60 border border-border/40 rounded-2xl rounded-tl-md px-4 py-3 backdrop-blur-sm">
                                <div className="flex gap-1.5">
                                    <motion.span
                                        animate={{ y: [0, -4, 0] }}
                                        transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                                        className="h-2 w-2 rounded-full bg-muted-foreground/40"
                                    />
                                    <motion.span
                                        animate={{ y: [0, -4, 0] }}
                                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
                                        className="h-2 w-2 rounded-full bg-muted-foreground/40"
                                    />
                                    <motion.span
                                        animate={{ y: [0, -4, 0] }}
                                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                                        className="h-2 w-2 rounded-full bg-muted-foreground/40"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </ScrollArea>

            {/* ── Input ─────────────────────────────────────────────────── */}
            <div className="p-3 border-t bg-gradient-to-r from-background to-muted/10">
                <div className="flex gap-2">
                    <Input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your answer..."
                        disabled={loading}
                        className="flex-1 bg-background border-border/50 focus-visible:ring-primary/30"
                    />
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={loading ? 'loading' : 'send'}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                            <Button
                                onClick={() => sendMessage()}
                                disabled={loading || !input.trim()}
                                size="icon"
                                className="shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/20 transition-shadow hover:shadow-blue-500/30"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
