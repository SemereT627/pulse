import { Tabs } from "@/components/tabs";

export function ReportTabs() {
  return (
    <Tabs
      label="Reports"
      tabs={[
        { href: "/reports", label: "Weekly" },
        { href: "/reports/periods", label: "Summaries" },
      ]}
    />
  );
}
