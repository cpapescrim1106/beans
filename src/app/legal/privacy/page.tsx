import DefaultLayout from "@/components/default-layout";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Beans",
  description: "Privacy Policy for Beans - AccuHear Bookkeeping Reconciliation",
};

export default function PrivacyPolicy() {
  return (
    <DefaultLayout title="Privacy Policy" description="Last Updated: January 28, 2025">
      <div className="prose prose-zinc dark:prose-invert max-w-3xl">
        <h2>Overview</h2>
        <p>
          Beans is an internal bookkeeping reconciliation tool operated by AccuHear.
          This policy describes how we handle data when connecting to QuickBooks Online.
        </p>

        <h2>Data We Access</h2>
        <p>When you authorize Beans to connect to QuickBooks Online, we access:</p>
        <ul>
          <li>Company financial data (transactions, deposits, accounts)</li>
          <li>Company profile information</li>
        </ul>

        <h2>How We Use Data</h2>
        <p>Data accessed from QuickBooks Online is used solely for:</p>
        <ul>
          <li>Reconciling transactions between systems</li>
          <li>Generating internal financial reports</li>
        </ul>

        <h2>Data Storage</h2>
        <ul>
          <li>Financial data is stored securely on AccuHear&apos;s internal systems</li>
          <li>We do not sell or share your data with third parties</li>
          <li>Data is retained only as long as necessary for business operations</li>
        </ul>

        <h2>Data Security</h2>
        <p>
          We implement reasonable security measures to protect your data, including
          encrypted connections and access controls.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about this privacy policy, contact:{" "}
          <a href="mailto:chrispape@accuhear.net">chrispape@accuhear.net</a>
        </p>

        <div className="mt-12 pt-8 border-t">
          <Link href="/legal/terms" className="text-primary hover:underline">
            View Terms of Service
          </Link>
        </div>
      </div>
    </DefaultLayout>
  );
}
