"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SectionForm from "../../SectionForm";
import { Spinner } from "@/components/ui";
import type { Section } from "../../../../types";

export default function EditSchemaPage() {
  const params = useParams();
  const siteKey = decodeURIComponent(params.site as string);
  const sectionKey = decodeURIComponent(params.key as string);
  const [section, setSection] = useState<Section | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cms/sites/${encodeURIComponent(siteKey)}/sections/${encodeURIComponent(sectionKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSection)
      .finally(() => setLoading(false));
  }, [siteKey, sectionKey]);

  if (loading)
    return (
      <div className="p-7">
        <Spinner />
      </div>
    );
  if (!section)
    return (
      <div className="px-[14px] pt-6 font-[var(--cp-mono)] text-[13px] text-[var(--md-sys-color-on-surface-variant)] md:px-7">
        section not found
      </div>
    );
  return <SectionForm siteKey={siteKey} initial={section} />;
}
