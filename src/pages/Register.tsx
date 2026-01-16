import { useState } from "react";
import { Link } from "react-router-dom";
import { RegistrationForm } from "@/components/RegistrationForm";
import { Copy, Check } from "lucide-react";

const Register = () => {
  const [registeredSlug, setRegisteredSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRegistrationSuccess = (slug: string) => {
    setRegisteredSlug(slug);
  };

  const profileLink = registeredSlug 
    ? `${window.location.origin}/contestant/${registeredSlug}`
    : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profileLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Register Your Child</h1>
        <p className="text-muted-foreground text-center mb-8">
          Fill in the details below to enter your child into the contest.
        </p>

        {registeredSlug ? (
          <div className="border border-border rounded p-6 bg-muted">
            <h2 className="text-xl font-semibold mb-4 text-center">Registration Successful!</h2>
            
            <div className="bg-destructive/10 border border-destructive/30 rounded p-4 mb-4">
              <p className="text-sm font-medium text-destructive mb-1">Important:</p>
              <p className="text-sm text-muted-foreground">
                Copy and save this link! You will need it to access your child's profile and share it with family and friends for voting.
              </p>
            </div>

            <p className="text-sm text-muted-foreground mb-2">Your child's unique profile link:</p>
            
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                readOnly
                value={profileLink}
                className="flex-1 border border-border p-2 rounded bg-background text-sm"
              />
              <button
                onClick={copyToClipboard}
                className="border border-border p-2 rounded hover:bg-background transition"
                title="Copy link"
              >
                {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <Link
                to={`/contestant/${registeredSlug}`}
                className="bg-primary text-primary-foreground px-4 py-2 rounded text-center font-medium"
              >
                View Profile
              </Link>
              <button
                onClick={() => setRegisteredSlug(null)}
                className="border border-border px-4 py-2 rounded text-center"
              >
                Register Another Child
              </button>
            </div>
          </div>
        ) : (
          <RegistrationForm onSuccess={handleRegistrationSuccess} />
        )}
      </div>
    </div>
  );
};

export default Register;
