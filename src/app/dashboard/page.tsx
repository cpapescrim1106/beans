import { auth } from "@/auth";
import DefaultLayout from "@/components/default-layout";
import { Button } from "@/components/ui/button";
import { getPosts } from "@/lib/services/post";
import type { SortOrder } from "@/lib/types/api";
import type { Session } from "next-auth";
import Link from "next/link";
import BlueprintReportTrigger from "./blueprint-report-trigger";
import UserPostsList from "./user-posts-list";

const DashboardPage = async () => {
  const session = (await auth()) as Session;
  const initialSortOrder: SortOrder = "desc";
  const userPosts = await getPosts({
    userId: session?.user.id,
    sortOrder: initialSortOrder,
  });

  return (
    <DefaultLayout title="My posts">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
        <Button asChild>
          <Link href="/api/auth/quickbooks">Connect QuickBooks</Link>
        </Button>
        <span>Authorize QuickBooks Online to sync deposits.</span>
      </div>
      <div className="mb-8">
        <BlueprintReportTrigger />
      </div>
      <UserPostsList
        session={session}
        initialPosts={userPosts}
        initialSortOrder={initialSortOrder}
      />
    </DefaultLayout>
  );
};
export default DashboardPage;
