"use client";

import type { ExperienceForm } from "@/api/types";
import { CrudScreen, optional } from "../CrudScreen";
import type { FormConfig } from "../EntityForm";
import { CheckboxField, LangPair, ListInput, ReorderList, TextField, withKey } from "../fields";

interface AchievementItem {
  key: number;
  textEn: string;
  textPl: string;
}

interface Draft {
  employer: string;
  client: string;
  roleEn: string;
  rolePl: string;
  locationEn: string;
  locationPl: string;
  start: string;
  end: string;
  published: boolean;
  achievements: AchievementItem[];
}

const MONTH_HINT = "Year and month, like 2021-04.";

const config: FormConfig<ExperienceForm, Draft> = {
  fields: ["employer", "client", "roleEn", "rolePl", "locationEn", "locationPl", "start", "end", "published", "achievements"],
  fromForm: (form) => ({
    employer: form?.employer ?? "",
    client: form?.client ?? "",
    roleEn: form?.roleEn ?? "",
    rolePl: form?.rolePl ?? "",
    locationEn: form?.locationEn ?? "",
    locationPl: form?.locationPl ?? "",
    start: form?.start ?? "",
    end: form?.end ?? "",
    published: form?.published ?? false,
    achievements: (form?.achievements ?? []).map((achievement) => withKey({ ...achievement })),
  }),
  toPayload: (draft) => ({
    employer: draft.employer.trim(),
    roleEn: draft.roleEn.trim(),
    rolePl: draft.rolePl.trim(),
    start: draft.start.trim(),
    published: draft.published,
    achievements: draft.achievements.map(({ textEn, textPl }) => ({ textEn: textEn.trim(), textPl: textPl.trim() })),
    ...optional("client", draft.client),
    ...optional("locationEn", draft.locationEn),
    ...optional("locationPl", draft.locationPl),
    ...optional("end", draft.end),
  }),
  renderFields: (form) => (
    <>
      <LangPair>
        <TextField form={form} name="roleEn" label="Role, English" required />
        <TextField form={form} name="rolePl" label="Role, Polish" required />
      </LangPair>
      <TextField form={form} name="employer" label="Employer" required />
      <TextField form={form} name="client" label="Client" />
      <LangPair>
        <TextField form={form} name="locationEn" label="Location, English" />
        <TextField form={form} name="locationPl" label="Location, Polish" />
      </LangPair>
      <LangPair>
        <TextField form={form} name="start" label="Start month" hint={MONTH_HINT} required inputMode="numeric" />
        <TextField
          form={form}
          name="end"
          label="End month"
          hint={`${MONTH_HINT} Leave empty for the current role.`}
          inputMode="numeric"
        />
      </LangPair>
      <CheckboxField form={form} name="published" label="Published" hint="Only published roles appear on the public site." />
      <ReorderList<AchievementItem>
        legend="Achievements"
        name="achievements"
        itemNoun="achievement"
        items={form.draft.achievements}
        itemText={(item) => item.textEn || item.textPl}
        errors={form.errors}
        clearErrors={form.clearErrors}
        newItem={() => withKey({ textEn: "", textPl: "" })}
        onChange={(items) => form.set("achievements", items)}
        renderItem={(item, index, update) => (
          <LangPair>
            <ListInput
              id={`${form.idBase}-achievement-${item.key}-en`}
              label={`Achievement ${index + 1}, English`}
              value={item.textEn}
              error={form.errors[`achievements[${index}].textEn`]}
              multiline
              onChange={(textEn) => update({ textEn })}
            />
            <ListInput
              id={`${form.idBase}-achievement-${item.key}-pl`}
              label={`Achievement ${index + 1}, Polish`}
              value={item.textPl}
              error={form.errors[`achievements[${index}].textPl`]}
              multiline
              onChange={(textPl) => update({ textPl })}
            />
          </LangPair>
        )}
      />
    </>
  ),
};

export function ExperiencesScreen() {
  return (
    <CrudScreen<ExperienceForm, Draft>
      path="/api/admin/experiences"
      noun="experience"
      config={config}
      itemLabel={(item) => `${item.roleEn}, ${item.employer}`}
      itemDetail={(item) =>
        `${item.start} to ${item.end ?? "present"}${item.published ? "" : ". Not published"}`
      }
      compare={(a, b) => b.start.localeCompare(a.start)}
    />
  );
}
