import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    FileText,
    MessageSquarePlus,
    LogOut,
    Moon,
    Sun,
    Zap,
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function AppLayout({ children }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('darkMode');
        if (saved === 'true') {
            setDarkMode(true);
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleDarkMode = () => {
        setDarkMode(!darkMode);
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('darkMode', (!darkMode).toString());
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navLinks = [
        { to: '/dashboard', label: 'Invoices', icon: FileText },
        { to: '/chat', label: 'New Invoice', icon: MessageSquarePlus },
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* Navbar */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-16 items-center justify-between px-4 md:px-6">
                    {/* Logo */}
                    <Link to="/dashboard" className="flex items-center gap-2 group">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-bg shadow-md group-hover:shadow-lg transition-shadow">
                            <Zap className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight hidden sm:inline">
                            <span className="gradient-text">Invoice</span>
                            <span className="text-foreground">Gen</span>
                        </span>
                    </Link>

                    {/* Nav Links */}
                    <nav className="flex items-center gap-1">
                        {navLinks.map(({ to, label, icon: Icon }) => (
                            <Link key={to} to={to}>
                                <Button
                                    variant={location.pathname === to ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="gap-2"
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{label}</span>
                                </Button>
                            </Link>
                        ))}
                    </nav>

                    {/* Right Side */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
                            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </Button>

                        <div className="flex items-center gap-3 pl-2 border-l">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user?.avatar} alt={user?.name} />
                                <AvatarFallback className="text-xs font-medium">
                                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium hidden md:inline">{user?.name}</span>
                            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">{children}</main>
        </div>
    );
}
