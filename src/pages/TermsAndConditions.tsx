const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Terms and Conditions</h1>
        
        <div className="space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Contest Overview</h2>
            <p>
              The Little Stars Contest is a voting competition for children. Participants can register their children 
              and collect votes from supporters. Each vote costs ₦50.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Eligibility</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Children must be under 18 years old to participate.</li>
              <li>Parents or guardians must register on behalf of their children.</li>
              <li>Each child can only be registered once.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Voting Rules</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Each vote costs ₦50.</li>
              <li>There is no limit to the number of votes a person can purchase.</li>
              <li>All votes are final and non-refundable.</li>
              <li>Votes are counted automatically and displayed on the leaderboard in real-time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Prizes</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>1st Place: ₦4,000,000</li>
              <li>2nd Place: ₦2,000,000</li>
              <li>3rd Place: ₦1,000,000</li>
              <li>4th & 5th Place: Compensation prizes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Payment</h2>
            <p>
              All payments are processed securely through Paystack. We do not store any payment card information.
              By making a payment, you agree to Paystack's terms of service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Privacy</h2>
            <p>
              We collect and store information provided during registration including child's name, age, and photo.
              This information is used solely for the purpose of the contest and will not be shared with third parties
              without consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Disqualification</h2>
            <p>
              The organizers reserve the right to disqualify any participant found engaging in fraudulent activities,
              including but not limited to fake votes, multiple registrations, or any form of manipulation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms and conditions at any time. Participants will be notified
              of any significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Contact</h2>
            <p>
              For any questions or concerns regarding the contest, please contact the organizers through the
              official channels provided on the website.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
