import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="container-main py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-primary mb-3">Little Stars Contest</h3>
            <p className="text-muted-foreground text-sm">
              A platform for parents to showcase their children and let the community vote for their favorites.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  Terms and Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-6 text-center text-sm text-muted-foreground">
          <p>{currentYear} Little Stars Contest. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
