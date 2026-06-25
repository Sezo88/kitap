"use client";

import { cn } from "@/lib/utils/cn";
import { createContext, useContext, useState, type ReactNode } from "react";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [activeTab, setActiveTab] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-start rounded-md bg-muted p-1 text-muted-foreground flex-wrap gap-y-1",
        className
      )}
    >
      {children}
    </div>
  );
}


function TabsTrigger({
  value,
  children,
  className,
  onClick,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");
  const isActive = ctx.activeTab === value;

  return (
    <button
      onClick={() => {
        ctx.setActiveTab(value);
        if (onClick) onClick();
      }}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer",
        isActive && "bg-background text-foreground shadow-sm",
        className
      )}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");
  if (ctx.activeTab !== value) return null;
  return <div className="mt-2">{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
