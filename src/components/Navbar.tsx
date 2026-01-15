import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/register', label: 'Register' },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, loading } = useAuth();

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="container-main">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">Little Stars</span>
          </Link>

          {/* Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Dropdown Navigation - Right aligned */}
        {isOpen && (
          <div className="absolute right-4 top-16 w-56 bg-card border border-border rounded-lg shadow-lg animate-fade-in z-50">
            <div className="flex flex-col py-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`px-4 py-3 transition-colors ${
                    isActive(link.href)
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/terms"
                className="px-4 py-3 transition-colors hover:bg-muted"
                onClick={() => setIsOpen(false)}
              >
                Terms
              </Link>
              {!loading && (
                <div className="px-4 py-2 border-t border-border mt-2">
                  {user ? (
                    <Button asChild className="w-full">
                      <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                        Dashboard
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild className="w-full">
                      <Link to="/auth" onClick={() => setIsOpen(false)}>
                        Login
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
