import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { WeekView, WeekViewSkeleton } from "@/components/week-view";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-4">
        <Suspense fallback={<WeekViewSkeleton />}>
          <WeekView />
        </Suspense>
      </main>
    </>
  );
}
