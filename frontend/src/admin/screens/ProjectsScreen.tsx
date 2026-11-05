"use client";

import type { ProjectForm } from "@/api/types";
import { CrudScreen, nextSortOrder, optional, wholeNumberError } from "../CrudScreen";
import type { FormConfig } from "../EntityForm";
import {
  CheckboxField,
  fromStringItems,
  LangPair,
  SelectField,
  type StringItem,
  StringList,
  TextField,
  toStringItems,
} from "../fields";

interface Draft {
  slug: string;
  nameEn: string;
  namePl: string;
  summaryEn: string;
  summaryPl: string;
  status: string;
  tech: StringItem[];
  repoUrl: string;
  liveUrl: string;
  sortOrder: string;
  published: boolean;
}

const STATUSES = [
  { value: "PLANNED", label: "Planned" },
  { value: "IN_DEVELOPMENT", label: "In development" },
  { value: "LIVE", label: "Live" },
] as const;

const config: FormConfig<ProjectForm, Draft> = {
  fields: ["slug", "nameEn", "namePl", "summaryEn", "summaryPl", "status", "tech", "repoUrl", "liveUrl", "sortOrder", "published"],
  fromForm: (form) => ({
    slug: form?.slug ?? "",
    nameEn: form?.nameEn ?? "",
    namePl: form?.namePl ?? "",
    summaryEn: form?.summaryEn ?? "",
    summaryPl: form?.summaryPl ?? "",
    status: form?.status ?? "PLANNED",
    tech: toStringItems(form?.tech ?? []),
    repoUrl: form?.repoUrl ?? "",
    liveUrl: form?.liveUrl ?? "",
    sortOrder: form ? String(form.sortOrder) : "",
    published: form?.published ?? false,
  }),
  toPayload: (draft) => ({
    slug: draft.slug.trim(),
    nameEn: draft.nameEn.trim(),
    namePl: draft.namePl.trim(),
    summaryEn: draft.summaryEn.trim(),
    summaryPl: draft.summaryPl.trim(),
    status: draft.status as ProjectForm["status"],
    tech: fromStringItems(draft.tech),
    sortOrder: Number(draft.sortOrder),
    published: draft.published,
    ...optional("repoUrl", draft.repoUrl),
    ...optional("liveUrl", draft.liveUrl),
  }),
  validate: (draft) => {
    const error = wholeNumberError(draft.sortOrder, { required: true });
    return error ? { sortOrder: error } : {};
  },
  renderFields: (form) => (
    <>
      <LangPair>
        <TextField form={form} name="nameEn" label="Name, English" required />
        <TextField form={form} name="namePl" label="Name, Polish" required />
      </LangPair>
      <TextField
        form={form}
        name="slug"
        label="Slug"
        hint="Lowercase letters, digits and hyphens, like my-project."
        required
      />
      <LangPair>
        <TextField form={form} name="summaryEn" label="Summary, English" required multiline />
        <TextField form={form} name="summaryPl" label="Summary, Polish" required multiline />
      </LangPair>
      <SelectField form={form} name="status" label="Status" options={STATUSES} />
      <StringList form={form} name="tech" legend="Tech" itemNoun="technology" />
      <TextField form={form} name="repoUrl" label="Source code address" type="url" hint="Starts with https://" />
      <TextField form={form} name="liveUrl" label="Live site address" type="url" hint="Starts with https://" />
      <TextField
        form={form}
        name="sortOrder"
        label="Sort order"
        hint="Lower numbers come first."
        required
        type="number"
      />
      <CheckboxField form={form} name="published" label="Published" />
    </>
  ),
};

export function ProjectsScreen() {
  return (
    <CrudScreen<ProjectForm, Draft>
      path="/api/admin/projects"
      noun="project"
      config={config}
      intro={
        <p className="notice">
          A project appears publicly only when it is published. The public projects section stays hidden while none is
          published.
        </p>
      }
      newItem={(items) => ({
        slug: "",
        nameEn: "",
        namePl: "",
        summaryEn: "",
        summaryPl: "",
        status: "PLANNED",
        tech: [],
        sortOrder: nextSortOrder(items),
        published: false,
      })}
      itemLabel={(item) => item.nameEn}
      itemDetail={(item) =>
        `${STATUSES.find((status) => status.value === item.status)?.label}. ${item.published ? "Published" : "Not published"}`
      }
      compare={(a, b) => a.sortOrder - b.sortOrder}
    />
  );
}
