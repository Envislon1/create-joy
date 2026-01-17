import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Navbar() {
  const location = useLocation();

  const links = [
    { to: "/", label: "Home" },
    { to: "/register", label: "Register" },
    { to: "/leaderboard", label: "Leaderboard" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="max-w-4xl mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="font-bold text-base sm:text-lg">
            Little Stars
          </Link>
          
          <div className="flex items-center gap-0.5 sm:gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-medium transition",
                  location.pathname === link.to
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
