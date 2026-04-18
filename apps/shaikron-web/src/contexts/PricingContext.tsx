import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

export type AdjustmentApplyMode = "new_customers_only" | "all_customers" | "next_billing_cycle";

export interface PriceAdjustment {
  id: string;
  type: "percentage" | "fixed";
  value: number;
  applyMode: AdjustmentApplyMode;
  effectiveDate: string; // ISO date string
}

export interface PriceVersion {
  id: string;
  label: string;
  basePrice: number;
  additionalPrice: number;
  startDate: string;
  endDate: string | null;
  adjustments: PriceAdjustment[];
}

type VersionStatus = "active" | "scheduled" | "expired";

export function getVersionStatus(version: PriceVersion): VersionStatus {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(version.startDate);
  start.setHours(0, 0, 0, 0);
  const end = version.endDate ? new Date(version.endDate) : null;
  if (end) end.setHours(23, 59, 59, 999);

  if (start > now) return "scheduled";
  if (end && end < now) return "expired";
  return "active";
}

interface PricingContextType {
  versions: PriceVersion[];
  activeVersion: PriceVersion | null;
  addVersion: (version: Omit<PriceVersion, "id">) => string | null;
  updateVersion: (id: string, updates: Partial<Omit<PriceVersion, "id">>) => string | null;
  addAdjustment: (versionId: string, adjustment: Omit<PriceAdjustment, "id">) => string | null;
  pricing: { planName: string; basePrice: number; pricePerUser: number };
}

const DEFAULT_VERSIONS: PriceVersion[] = [
  {
    id: "v1",
    label: "Base Plan",
    basePrice: 97,
    additionalPrice: 29.9,
    startDate: "2026-01-01",
    endDate: null,
    adjustments: [],
  },
];

const PricingContext = createContext<PricingContextType | null>(null);

function checkOverlap(versions: PriceVersion[], newVersion: Omit<PriceVersion, "id"> & { id?: string }): boolean {
  const newStart = new Date(newVersion.startDate);
  const newEnd = newVersion.endDate ? new Date(newVersion.endDate) : null;

  for (const v of versions) {
    if (newVersion.id && v.id === newVersion.id) continue;
    const vStart = new Date(v.startDate);
    const vEnd = v.endDate ? new Date(v.endDate) : null;

    // Check overlap: two ranges overlap if start1 <= end2 AND start2 <= end1
    const s1 = newStart, e1 = newEnd;
    const s2 = vStart, e2 = vEnd;

    const startsBeforeEnd2 = e2 ? s1 <= e2 : true;
    const startsBeforeEnd1 = e1 ? s2 <= e1 : true;

    if (startsBeforeEnd2 && startsBeforeEnd1) {
      // Both active ranges overlap
      const status1 = getVersionStatus({ ...newVersion, id: newVersion.id || "tmp" } as PriceVersion);
      const status2 = getVersionStatus(v);
      // Only warn if both would be active or scheduled (not expired)
      if (status1 !== "expired" && status2 !== "expired") {
        return true;
      }
    }
  }
  return false;
}

export function PricingProvider({ children }: { children: ReactNode }) {
  const [versions, setVersions] = useState<PriceVersion[]>(DEFAULT_VERSIONS);

  const activeVersion = useMemo(() => {
    return versions.find(v => getVersionStatus(v) === "active") || null;
  }, [versions]);

  const addVersion = (version: Omit<PriceVersion, "id">): string | null => {
    if (checkOverlap(versions, version)) {
      return "Only one active pricing version is allowed. Date range overlaps with an existing version.";
    }
    const id = `v${Date.now()}`;
    setVersions(prev => [...prev, { ...version, id, adjustments: version.adjustments || [] }]);
    return null;
  };

  const addAdjustment = (versionId: string, adjustment: Omit<PriceAdjustment, "id">): string | null => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return "Version not found";
    if (getVersionStatus(version) === "expired") return "Cannot add adjustments to expired versions";
    const id = `adj${Date.now()}`;
    setVersions(prev => prev.map(v =>
      v.id === versionId
        ? { ...v, adjustments: [...v.adjustments, { ...adjustment, id }] }
        : v
    ));
    return null;
  };

  const updateVersion = (id: string, updates: Partial<Omit<PriceVersion, "id">>): string | null => {
    const existing = versions.find(v => v.id === id);
    if (!existing) return "Version not found";
    if (getVersionStatus(existing) === "expired") return "Past versions cannot be edited";

    const merged = { ...existing, ...updates };
    if (checkOverlap(versions, merged)) {
      return "Only one active pricing version is allowed. Date range overlaps with an existing version.";
    }
    setVersions(prev => prev.map(v => v.id === id ? merged : v));
    return null;
  };

  const pricing = useMemo(() => ({
    planName: activeVersion?.label || "Base Plan",
    basePrice: activeVersion?.basePrice || 0,
    pricePerUser: activeVersion?.additionalPrice || 0,
  }), [activeVersion]);

  return (
    <PricingContext.Provider value={{ versions, activeVersion, addVersion, updateVersion, addAdjustment, pricing }}>
      {children}
    </PricingContext.Provider>
  );
}

export function usePricingContext() {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricingContext must be used within PricingProvider");
  return ctx;
}
