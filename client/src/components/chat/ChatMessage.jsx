import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import { motion } from 'framer-motion';

const messageVariants = {
    hidden: (isBot) => ({
        opacity: 0,
        x: isBot ? -20 : 20,
        y: 8,
    }),
    visible: {
        opacity: 1,
        x: 0,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 300,
            damping: 24,
            mass: 0.8,
        },
    },
};

const avatarVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
        scale: 1,
        opacity: 1,
        transition: { type: 'spring', stiffness: 400, damping: 20, delay: 0.1 },
    },
};

export default function ChatMessage({ message, isBot, index = 0 }) {
    // Parse markdown-style bold and code text
    const renderText = (text) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={i} className="font-semibold text-foreground">
                        {part.slice(2, -2)}
                    </strong>
                );
            }
            const codeParts = part.split(/(`[^`]+`)/g);
            return codeParts.map((cp, j) => {
                if (cp.startsWith('`') && cp.endsWith('`')) {
                    return (
                        <code
                            key={`${i}-${j}`}
                            className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-mono font-medium"
                        >
                            {cp.slice(1, -1)}
                        </code>
                    );
                }
                return cp;
            });
        });
    };

    const lines = message.split('\n');

    return (
        <motion.div
            custom={isBot}
            variants={messageVariants}
            initial="hidden"
            animate="visible"
            className={cn(
                'flex gap-3',
                isBot ? 'justify-start' : 'justify-end'
            )}
        >
            {/* Bot Avatar */}
            {isBot && (
                <motion.div
                    variants={avatarVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25"
                >
                    <Bot className="h-4 w-4 text-white" />
                </motion.div>
            )}

            {/* Message Bubble */}
            <div
                className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    isBot
                        ? 'bg-muted/60 border border-border/40 text-foreground rounded-tl-md backdrop-blur-sm'
                        : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-tr-md shadow-lg shadow-blue-500/20'
                )}
            >
                {lines.map((line, i) => (
                    <p key={i} className={cn(i > 0 && 'mt-1.5')}>
                        {line === '' ? <br /> : renderText(line)}
                    </p>
                ))}
            </div>

            {/* User Avatar */}
            {!isBot && (
                <motion.div
                    variants={avatarVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 shadow-sm"
                >
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </motion.div>
            )}
        </motion.div>
    );
}
