import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    MessageSquare,
    FileText,
    Send,
    Zap,
    ArrowRight,
    CheckCircle2,
    Shield,
} from 'lucide-react';
import api from '@/lib/api';

const features = [
    {
        icon: MessageSquare,
        title: 'Chat-Based Creation',
        description: 'Build invoices through a natural conversation — no forms needed.',
    },
    {
        icon: FileText,
        title: 'Professional PDFs',
        description: 'Generate polished PDF invoices with one click.',
    },
    {
        icon: Send,
        title: 'Email Delivery',
        description: 'Send invoices directly via Gmail with PDF attachment.',
    },
    {
        icon: Shield,
        title: 'Secure & Private',
        description: 'Your data is protected with Google OAuth authentication.',
    },
];

export default function LoginPage() {
    const handleLogin = async () => {
        try {
            const { data } = await api.get('/auth/google');
            window.location.href = data.url;
        } catch {
            alert('Failed to initiate login');
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="p-4 md:p-6">
                <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-bg shadow-md">
                        <Zap className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">
                        <span className="gradient-text">Invoice</span>
                        <span className="text-foreground">Gen</span>
                    </span>
                </div>
            </header>

            {/* Hero */}
            <main className="flex-1 flex items-center justify-center p-4 md:p-8">
                <div className="max-w-5xl w-full">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Left - Copy */}
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                    <Zap className="h-3.5 w-3.5" />
                                    AI-Powered Invoice Generator
                                </div>
                                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                                    Create invoices
                                    <br />
                                    <span className="gradient-text">by just chatting</span>
                                </h1>
                                <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                                    Simply describe your invoice in a conversation, preview it live, and send it — all in one place.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button size="lg" onClick={handleLogin} className="gap-2 text-base px-8">
                                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Sign in with Google
                                </Button>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    Free to use
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    No credit card
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    Instant setup
                                </div>
                            </div>
                        </div>

                        {/* Right - Features */}
                        <div className="grid grid-cols-2 gap-3">
                            {features.map(({ icon: Icon, title, description }, i) => (
                                <Card
                                    key={i}
                                    className="p-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default group"
                                >
                                    <CardContent className="p-0 space-y-2">
                                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                            <Icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <h3 className="font-semibold text-sm">{title}</h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="p-4 text-center text-xs text-muted-foreground border-t">
                Built with ❤️ using MERN Stack • Powered by Invoice-Generator.com
            </footer>
        </div>
    );
}
