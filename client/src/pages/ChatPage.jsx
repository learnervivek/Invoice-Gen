import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import ChatPanel from '@/components/chat/ChatPanel';
import InvoicePreview from '@/components/invoice/InvoicePreview';
import { X } from 'lucide-react';

export default function ChatPage() {
    // Only local UI state — layout-specific concern
    const [showMobilePreview, setShowMobilePreview] = useState(false);

    return (
        <AppLayout>
            <div className="h-[calc(100vh-4rem)] flex relative overflow-hidden">
                {/* Chat Panel - Left */}
                <div className="w-full lg:w-[480px] xl:w-[520px] border-r flex-shrink-0">
                    <ChatPanel
                        onTogglePreview={() => setShowMobilePreview(true)}
                    />
                </div>

                {/* Invoice Preview - Right (Desktop) */}
                <div className="hidden lg:flex flex-1 bg-muted/20">
                    <div className="w-full">
                        <InvoicePreview />
                    </div>
                </div>

                {/* Invoice Preview - Mobile Overlay */}
                <AnimatePresence>
                    {showMobilePreview && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                                onClick={() => setShowMobilePreview(false)}
                            />

                            {/* Slide-in Preview Panel */}
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className="fixed inset-y-0 right-0 w-full sm:w-[85%] bg-background z-50 lg:hidden shadow-2xl"
                            >
                                {/* Close Button */}
                                <div className="flex items-center justify-between px-4 py-3 border-b">
                                    <h3 className="text-sm font-semibold">Invoice Preview</h3>
                                    <button
                                        onClick={() => setShowMobilePreview(false)}
                                        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Preview Content */}
                                <div className="h-[calc(100%-52px)] overflow-y-auto">
                                    <InvoicePreview />
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </AppLayout>
    );
}
