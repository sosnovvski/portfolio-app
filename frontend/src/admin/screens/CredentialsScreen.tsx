"use client";

import type { CredentialForm } from "@/api/types";
import { CrudScreen, nextSortOrder, optional, wholeNumberError } from "../CrudScreen";
import type { FormConfig } from "../EntityForm";
import { LangPair, SelectField, TextField } from "../fields";

interface Draft {
  kind: string;
  titleEn: string;
  titlePl: string;
  issuer: string;
  startYear: string;
  endYear: string;
  url: string;
  sortOrder: string;
}

const KINDS = [
  { value: "CERTIFICATION", label: "Certification" },
  { value: "EDUCATION", label: "Education" },
] as const;

function optionalNumber<K extends string>(key: K, value: string): { [P in K]?: number } {
  const text = value.trim();
  return (text ? { [key]: Number(text) } : {}) as { [P in K]?: number };
}

const config: FormConfig<CredentialForm, Draft> = {
  fields: ["kind", "titleEn", "titlePl", "issuer", "startYear", "endYear", "url", "sortOrder"],
  fromForm: (form) => ({
    kind: form?.kind ?? "CERTIFICATION",
    titleEn: form?.titleEn ?? "",
    titlePl: form?.titlePl ?? "",
    issuer: form?.issuer ?? "",
    startYear: form?.startYear?.toString() ?? "",
    endYear: form?.endYear?.toString() ?? "",
    url: form?.url ?? "",
    sortOrder: form ? String(form.sortOrder) : "",
  }),
  toPayload: (draft) => ({
    kind: draft.kind as CredentialForm["kind"],
    titleEn: draft.titleEn.trim(),
    titlePl: draft.titlePl.trim(),
    issuer: draft.issuer.trim(),
    sortOrder: Number(draft.sortOrder),
    ...optionalNumber("startYear", draft.startYear),
    ...optionalNumber("endYear", draft.endYear),
    ...optional("url", draft.url),
  }),
  validate: (draft) => {
    const errors: Record<string, string> = {};
    const sortOrder = wholeNumberError(draft.sortOrder, { required: true });
    const startYear = wholeNumberError(draft.startYear, { required: false });
    const endYear = wholeNumberError(draft.endYear, { required: false });
    if (sortOrder) errors["sortOrder"] = sortOrder;
    if (startYear) errors["startYear"] = startYear;
    if (endYear) errors["endYear"] = endYear;
    return errors;
  },
  renderFields: (form) => (
    <>
      <SelectField form={form} name="kind" label="Kind" options={KINDS} />
      <LangPair>
        <TextField form={form} name="titleEn" label="Title, English" required />
        <TextField form={form} name="titlePl" label="Title, Polish" required />
      </LangPair>
      <TextField form={form} name="issuer" label="Issuer" required />
      <LangPair>
        <TextField form={form} name="startYear" label="Start year" type="number" />
        <TextField form={form} name="endYear" label="End year" type="number" />
      </LangPair>
      <TextField form={form} name="url" label="Address" type="url" hint="Starts with https://" />
      <TextField
        form={form}
        name="sortOrder"
        label="Sort order"
        hint="Lower numbers come first."
        required
        type="number"
      />
    </>
  ),
};

export function CredentialsScreen() {
  return (
    <CrudScreen<CredentialForm, Draft>
      path="/api/admin/credentials"
      noun="credential"
      config={config}
      newItem={(items) => ({
        kind: "CERTIFICATION",
        titleEn: "",
        titlePl: "",
        issuer: "",
        sortOrder: nextSortOrder(items),
      })}
      itemLabel={(item) => item.titleEn}
      itemDetail={(item) => `${item.kind === "EDUCATION" ? "Education" : "Certification"}, ${item.issuer}`}
      compare={(a, b) => a.sortOrder - b.sortOrder}
    />
  );
}
