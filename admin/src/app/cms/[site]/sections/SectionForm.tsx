"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select, Label, Callout, Textarea } from "@/components/ui";
import type { Field, FieldType, Section } from "../../types";

const TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text — one line" },
  { value: "textarea", label: "Text — paragraph" },
  { value: "paragraphs", label: "Paragraphs — many blocks" },
  { value: "stringlist", label: "List — one item per line" },
  { value: "select", label: "Choice — pick one option" },
  { value: "image", label: "Image" },
  { value: "pairs", label: "Label / value pairs" },
  { value: "object", label: "Group — named subfields" },
  { value: "list", label: "Repeatable group" },
];
const hasSubfields = (t: FieldType) => t === "object" || t === "list";
const enc = encodeURIComponent;

export default function SectionForm({
  siteKey,
  initial,
}: {
  siteKey: string;
  initial?: Section;
}) {
  const router = useRouter();
  const editing = !!initial;

  const [key, setKey] = useState(initial?.key ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [pageGroup, setPageGroup] = useState(initial?.pageGroup ?? "content");
  const [localized, setLocalized] = useState(initial?.localized ?? true);
  const [fields, setFields] = useState<Field[]>(initial?.schema ?? []);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const patchField = (i: number, p: Partial<Field>) =>
    setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const addField = () =>
    setFields((fs) => [...fs, { key: "", label: "", type: "text" }]);
  const removeField = (i: number) =>
    setFields((fs) => fs.filter((_, j) => j !== i));
  const subs = (i: number) => fields[i].fields ?? [];
  const addSub = (i: number) =>
    patchField(i, { fields: [...subs(i), { key: "", label: "", type: "text" }] });
  const patchSub = (i: number, si: number, p: Partial<Field>) =>
    patchField(i, { fields: subs(i).map((s, j) => (j === si ? { ...s, ...p } : s)) });
  const removeSub = (i: number, si: number) =>
    patchField(i, { fields: subs(i).filter((_, j) => j !== si) });

  async function save() {
    setErr("");
    setBusy(true);
    const body = { title, pageGroup, localized, fields, ...(editing ? {} : { key }) };
    const url = editing
      ? `/api/cms/sites/${enc(siteKey)}/sections/${enc(key)}`
      : `/api/cms/sites/${enc(siteKey)}/sections`;
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error || "could not save section");
      return;
    }
    router.push(`/cms/${enc(siteKey)}`);
  }

  async function remove() {
    if (!confirm(`Delete section "${title || key}" and its content?`)) return;
    setBusy(true);
    const res = await fetch(`/api/cms/sites/${enc(siteKey)}/sections/${enc(key)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      setErr("could not delete section");
      return;
    }
    router.push(`/cms/${enc(siteKey)}`);
  }

  return (
    <div className="px-[14px] pb-12 pt-4 md:px-7 md:pb-[60px] md:pt-6" style={{ maxWidth: 760 }}>
      <Button variant="ghost" size="sm" onClick={() => router.push(`/cms/${enc(siteKey)}`)} className="mb-5 pl-[10px]! pr-[14px]!">
        <span className="msym text-[17px]">arrow_back</span>back
      </Button>

      <h2 className="mb-5 font-[var(--cp-mono)] text-[21px] font-semibold md:text-[24px]">
        {editing ? "Edit section" : "New section"}
      </h2>

      {/* meta */}
      <Card className="mb-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>KEY</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder="hero"
              disabled={editing}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>TITLE</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hero" className="mt-1.5" />
          </div>
          <div>
            <Label>GROUP</Label>
            <Input value={pageGroup} onChange={(e) => setPageGroup(e.target.value)} placeholder="content" className="mt-1.5" />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="md"
              variant={localized ? "tonal" : "soft"}
              onClick={() => setLocalized((v) => !v)}
            >
              <span className="msym text-[17px]">translate</span>
              per-language: {localized ? "on" : "off"}
            </Button>
          </div>
        </div>
      </Card>

      {/* fields */}
      <Label as="div" className="mb-2.5 block">{"// FIELDS"}</Label>
      <div className="flex flex-col gap-2.5">
        {fields.map((f, i) => (
          <Card key={i} pad={false} className="p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Input value={f.key} onChange={(e) => patchField(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} placeholder="key" className="max-w-[150px]" size="sm" />
              <Input value={f.label} onChange={(e) => patchField(i, { label: e.target.value })} placeholder="label" className="max-w-[200px]" size="sm" />
              <Select size="sm" value={f.type} onChange={(e) => patchField(i, { type: e.target.value as FieldType })} className="max-w-[210px]">
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" danger onClick={() => removeField(i)} className="px-2.5!">
                <span className="msym text-[16px]">close</span>
              </Button>
            </div>

            {hasSubfields(f.type) && (
              <div className="mt-3 border-l-2 border-[var(--md-sys-color-outline-variant)] pl-3">
                <Label as="div" className="mb-2 block">SUBFIELDS</Label>
                <div className="flex flex-col gap-2">
                  {subs(i).map((s, si) => (
                    <div key={si} className="flex flex-wrap items-center gap-2">
                      <Input value={s.key} onChange={(e) => patchSub(i, si, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} placeholder="key" className="max-w-[140px]" size="sm" />
                      <Input value={s.label} onChange={(e) => patchSub(i, si, { label: e.target.value })} placeholder="label" className="max-w-[180px]" size="sm" />
                      <Select size="sm" value={s.type} onChange={(e) => patchSub(i, si, { type: e.target.value as FieldType })} className="max-w-[190px]">
                        {TYPES.filter((t) => !hasSubfields(t.value)).map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </Select>
                      <div className="flex-1" />
                      <Button variant="ghost" size="sm" danger onClick={() => removeSub(i, si)} className="px-2.5!">
                        <span className="msym text-[16px]">close</span>
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="soft" size="sm" onClick={() => addSub(i)} className="mt-2">
                  <span className="msym text-[16px]">add</span>subfield
                </Button>
              </div>
            )}

            {f.type === "select" && (
              <OptionsEditor
                value={f.options ?? []}
                onChange={(options) => patchField(i, { options })}
              />
            )}

            {subs(i).some((s) => s.type === "select") && (
              <div className="mt-3 border-l-2 border-[var(--md-sys-color-outline-variant)] pl-3">
                {subs(i).map((s, si) =>
                  s.type === "select" ? (
                    <div key={si} className="mb-2">
                      <Label as="div" className="mb-1 block">{(s.label || s.key || "choice")} — options</Label>
                      <OptionsEditor
                        value={s.options ?? []}
                        onChange={(options) => patchSub(i, si, { options })}
                      />
                    </div>
                  ) : null
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Button variant="soft" size="md" onClick={addField} className="mt-3">
        <span className="msym text-[17px]">add</span>add field
      </Button>

      {err && <Callout tone="err" icon="error" className="mt-5">{err}</Callout>}

      <div className="mt-6 flex items-center gap-2">
        <Button size="lg" onClick={save} disabled={busy || !key || fields.length === 0}>
          <span className="msym text-[18px]">check</span>
          {editing ? "save section" : "create section"}
        </Button>
        <div className="flex-1" />
        {editing && (
          <Button variant="ghost" size="md" danger onClick={remove} disabled={busy}>delete section</Button>
        )}
      </div>
    </div>
  );
}

// OptionsEditor edits a select field's allowed values, one per line. Blank lines
// are kept while typing and dropped on save (server-side sanitizeFields).
function OptionsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (options: string[]) => void;
}) {
  return (
    <div className="mt-3 border-l-2 border-[var(--md-sys-color-outline-variant)] pl-3">
      <Label as="div" className="mb-1 block">OPTIONS — one per line</Label>
      <Textarea
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        placeholder={"mail\nphone\ncalendar"}
        className="min-h-[88px] font-[var(--cp-mono)] text-[12px]"
      />
    </div>
  );
}
