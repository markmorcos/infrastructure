"use client";

import { useParams } from "next/navigation";
import SectionForm from "../SectionForm";

export default function NewSectionPage() {
  const params = useParams();
  const siteKey = decodeURIComponent(params.site as string);
  return <SectionForm siteKey={siteKey} />;
}
