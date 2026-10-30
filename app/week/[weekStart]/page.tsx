import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { WeekView, WeekViewSkeleton } from "@/components/week-view";
import { isValidDate } from "@/lib/report/week";

export default function WeekPage({ params }: PageProps<"/week/[weekStart]">) {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-4">
        <Suspense fallback={<WeekViewSkeleton />}>
          <Week params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Week({ params }: Pick<PageProps<"/week/[weekStart]">, "params">) {
  const { weekStart } = await params;
  if (!isValidDate(weekStart)) notFound();
  return <WeekView weekStart={weekStart} />;
}
