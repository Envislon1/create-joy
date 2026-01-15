import { Layout } from '@/components/Layout';

const Terms = () => {
  return (
    <Layout>
      <div className="container-main py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
          <p className="text-muted-foreground mb-8">
            Last updated: January 2025
          </p>

          <div className="prose prose-gray max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to Little Stars Contest. By participating in this contest, either as a parent/guardian registering a child or as a voter, you agree to be bound by these Terms and Conditions. Please read them carefully before proceeding.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>The contest is open to children aged 1-12 years.</li>
                <li>Registration must be completed by a parent or legal guardian.</li>
                <li>Each child can only be registered once per contest period.</li>
                <li>The parent/guardian must provide accurate and truthful information during registration.</li>
                <li>Participants must be residents of Nigeria.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Registration</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Registration is free of charge.</li>
                <li>A clear, recent photograph of the child must be uploaded during registration.</li>
                <li>The organizers reserve the right to reject any registration that does not meet the guidelines.</li>
                <li>By registering, you grant the organizers permission to display your child's photo and name on the contest platform.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Voting</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Each vote costs N50 (Nigerian Naira).</li>
                <li>There is no limit to the number of votes a person can purchase for a contestant.</li>
                <li>Votes are purchased through our secure Paystack payment gateway.</li>
                <li>All vote purchases are final and non-refundable.</li>
                <li>Votes are counted in real-time and reflected on the leaderboard.</li>
                <li>The organizers are not responsible for any payment failures due to network issues or bank-related problems.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Contest Duration</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>The contest start and end dates will be announced on the website.</li>
                <li>The organizers reserve the right to extend, shorten, or modify the contest period at their discretion.</li>
                <li>Voting will be closed at the announced end time, and no further votes will be accepted.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Prizes</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Prizes will be awarded to the top contestants based on the final vote count.</li>
                <li>Prize details will be announced before or during the contest period.</li>
                <li>Prizes are non-transferable and cannot be exchanged for cash.</li>
                <li>Winners will be contacted using the contact information provided during registration.</li>
                <li>Winners must claim their prizes within 30 days of announcement.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Content Guidelines</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Photos must be appropriate and suitable for all ages.</li>
                <li>Photos must not contain any offensive, violent, or inappropriate content.</li>
                <li>The organizers reserve the right to remove any content that violates these guidelines.</li>
                <li>Contestants found violating content guidelines may be disqualified without refund of votes received.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Privacy</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Personal information collected during registration will be used solely for contest purposes.</li>
                <li>We will not share your personal information with third parties without your consent.</li>
                <li>Photos and names of contestants will be publicly displayed on the contest platform.</li>
                <li>Voter email addresses will be used only for transaction confirmations.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Disqualification</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                The organizers reserve the right to disqualify any contestant for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Providing false or misleading information during registration.</li>
                <li>Attempting to manipulate the voting system.</li>
                <li>Engaging in fraudulent activities.</li>
                <li>Violating any of these terms and conditions.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Liability</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>The organizers are not liable for any technical issues that may affect voting or registration.</li>
                <li>The organizers are not responsible for any disputes arising from the contest results.</li>
                <li>Participation in this contest is at the participant's own risk.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Modifications</h2>
              <p className="text-muted-foreground leading-relaxed">
                The organizers reserve the right to modify these terms and conditions at any time. Any changes will be posted on the website, and continued participation constitutes acceptance of the modified terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                For any questions or concerns regarding these terms and conditions or the contest in general, please contact us through the information provided on our website.
              </p>
            </section>

            <section className="bg-muted/50 p-6 rounded-lg">
              <p className="text-muted-foreground text-sm">
                By registering for or voting in the Little Stars Contest, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
              </p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Terms;
