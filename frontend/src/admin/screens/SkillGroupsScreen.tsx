"use client";

import type { SkillGroupForm } from "@/api/types";
import { CrudScreen, nextSortOrder, wholeNumberError } from "../CrudScreen";
import type { FormConfig } from "../EntityForm";
import { fromStringItems, LangPair, type StringItem, StringList, TextField, toStringItems } from "../fields";

interface Draft {
  nameEn: string;
  namePl: string;
  sortOrder: string;
  skills: StringItem[];
}

const config: FormConfig<SkillGroupForm, Draft> = {
  fields: ["nameEn", "namePl", "sortOrder", "skills"],
  fromForm: (form) => ({
    nameEn: form?.nameEn ?? "",
    namePl: form?.namePl ?? "",
    sortOrder: form ? String(form.sortOrder) : "",
    skills: toStringItems(form?.skills ?? []),
  }),
  toPayload: (draft) => ({
    nameEn: draft.nameEn.trim(),
    namePl: draft.namePl.trim(),
    sortOrder: Number(draft.sortOrder),
    skills: fromStringItems(draft.skills),
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
        name="sortOrder"
        label="Sort order"
        hint="Lower numbers come first."
        required
        type="number"
      />
      <StringList form={form} name="skills" legend="Skills" itemNoun="skill" />
    </>
  ),
};

export function SkillGroupsScreen() {
  return (
    <CrudScreen<SkillGroupForm, Draft>
      path="/api/admin/skill-groups"
      noun="skill group"
      config={config}
      newItem={(items) =>
        ({ nameEn: "", namePl: "", skills: [], sortOrder: nextSortOrder(items) })
      }
      itemLabel={(item) => item.nameEn}
      itemDetail={(item) => item.skills.join(", ")}
      compare={(a, b) => a.sortOrder - b.sortOrder}
    />
  );
}
