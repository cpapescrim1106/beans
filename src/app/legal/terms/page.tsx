import DefaultLayout from "@/components/default-layout";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Beans",
  description: "Terms of Service for Beans - AccuHear Bookkeeping Reconciliation",
};

export default function TermsOfService() {
  return (
    <DefaultLayout title="Terms of Service" description="Last Updated: January 28, 2025">
      <div className="prose prose-zinc dark:prose-invert max-w-3xl">
        <h2>Agreement</h2>
        <p>
          By using Beans (&quot;the Application&quot;), you agree to these terms.
        </p>

        <h2>License</h2>
        <p>
          AccuHear grants authorized users a limited, non-exclusive license to use
          Beans for internal business purposes.
        </p>

        <h2>Permitted Use</h2>
        <ul>
          <li>Connect to QuickBooks Online for financial reconciliation</li>
          <li>Generate reports for internal use</li>
        </ul>

        <h2>Restrictions</h2>
        <ul>
          <li>Do not reverse engineer or modify the application</li>
          <li>Do not use the application for unauthorized purposes</li>
        </ul>

        <h2>Disclaimer</h2>
        <p>
          THE APPLICATION IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY OF ANY KIND.
          ACCUHEAR SHALL NOT BE LIABLE FOR ANY DAMAGES ARISING FROM USE OF THE APPLICATION.
        </p>

        <h2>QuickBooks Online</h2>
        <p>
          Use of QuickBooks Online data is subject to Intuit&apos;s terms of service.
        </p>

        <h2>Changes</h2>
        <p>
          AccuHear may update these terms at any time. Continued use constitutes acceptance.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about these terms, contact:{" "}
          <a href="mailto:chrispape@accuhear.net">chrispape@accuhear.net</a>
        </p>

        <div className="mt-12 pt-8 border-t">
          <Link href="/legal/privacy" className="text-primary hover:underline">
            View Privacy Policy
          </Link>
        </div>
      </div>
    </DefaultLayout>
  );
}
