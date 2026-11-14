import { Tabs } from "@/components/tabs";

export function RepoTabs() {
  return (
    <Tabs
      label="Repositories"
      tabs={[
        { href: "/repositories", label: "Activity" },
        { href: "/repositories/manage", label: "Tracked repos" },
      ]}
    />
  );
}
