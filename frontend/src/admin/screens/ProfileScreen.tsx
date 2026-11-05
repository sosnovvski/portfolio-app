"use client";

import { useEffect, useState } from "react";
import type { ProfileForm } from "@/api/types";
import { type ApiResult, failureText } from "../api";
import { optional } from "../CrudScreen";
import { EntityForm, type FormConfig } from "../EntityForm";
import { LangPair, TextField } from "../fields";
import { useAdminSession } from "../session";

type Draft = Omit<Required<ProfileForm>, "version">;

const EMPTY: Draft = {
  fullName: "",
  headlineEn: "",
  headlinePl: "",
  summaryEn: "",
  summaryPl: "",
  locationEn: "",
  locationPl: "",
  linkedinUrl: "",
  githubUrl: "",
  publicEmail: "",
};

const config: FormConfig<ProfileForm, Draft> = {
  fields: Object.keys(EMPTY),
  fromForm: (form) => ({
    fullName: form?.fullName ?? "",
    headlineEn: form?.headlineEn ?? "",
    headlinePl: form?.headlinePl ?? "",
    summaryEn: form?.summaryEn ?? "",
    summaryPl: form?.summaryPl ?? "",
    locationEn: form?.locationEn ?? "",
    locationPl: form?.locationPl ?? "",
    linkedinUrl: form?.linkedinUrl ?? "",
    githubUrl: form?.githubUrl ?? "",
    publicEmail: form?.publicEmail ?? "",
  }),
  toPayload: (draft) => ({
    fullName: draft.fullName.trim(),
    headlineEn: draft.headlineEn.trim(),
    headlinePl: draft.headlinePl.trim(),
    summaryEn: draft.summaryEn.trim(),
    summaryPl: draft.summaryPl.trim(),
    locationEn: draft.locationEn.trim(),
    locationPl: draft.locationPl.trim(),
    ...optional("linkedinUrl", draft.linkedinUrl),
    ...optional("githubUrl", draft.githubUrl),
    ...optional("publicEmail", draft.publicEmail),
  }),
  renderFields: (form) => (
    <>
      <TextField form={form} name="fullName" label="Full name" required />
      <LangPair>
        <TextField form={form} name="headlineEn" label="Headline, English" required />
        <TextField form={form} name="headlinePl" label="Headline, Polish" required />
      </LangPair>
      <LangPair>
        <TextField
          form={form}
          name="summaryEn"
          label="Summary, English"
          hint="Separate paragraphs with a blank line."
          required
          multiline
        />
        <TextField
          form={form}
          name="summaryPl"
          label="Summary, Polish"
          hint="Separate paragraphs with a blank line."
          required
          multiline
        />
      </LangPair>
      <LangPair>
        <TextField form={form} name="locationEn" label="Location, English" required />
        <TextField form={form} name="locationPl" label="Location, Polish" required />
      </LangPair>
      <TextField form={form} name="linkedinUrl" label="LinkedIn address" type="url" hint="Starts with https://" />
      <TextField
        form={form}
        name="githubUrl"
        label="GitHub address"
        type="url"
        hint="Starts with https://. The GitHub link stays hidden until this is set."
      />
      <TextField
        form={form}
        name="publicEmail"
        label="Public email"
        type="email"
        hint="Shown on the contact section and in the privacy notice."
      />
    </>
  ),
};

/** `form` null means no profile exists yet: the empty form is shown and the first save creates it. */
type Loaded = { form: ProfileForm | null };

export function ProfileScreen() {
  const { api, generation } = useAdminSession();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stale = false;
    void api.get<ProfileForm>("/api/admin/profile").then((result) => {
      if (stale) {
        return;
      }
      if (result.ok) {
        // Once loaded, the form owns its text. A later login must not replace what was typed.
        setLoaded((current) => current ?? { form: result.data });
        setLoadError(null);
      } else if (result.failure.kind === "notFound") {
        setLoaded((current) => current ?? { form: null });
        setLoadError(null);
      } else {
        setLoadError(failureText(result.failure));
      }
    });
    return () => {
      stale = true;
    };
  }, [api, generation, attempt]);

  async function reload(): Promise<ApiResult<ProfileForm | null>> {
    const result = await api.get<ProfileForm>("/api/admin/profile");
    if (!result.ok && result.failure.kind === "notFound") {
      return { ok: true, status: 200, data: null };
    }
    return result;
  }

  if (!loaded) {
    return loadError ? (
      <div role="alert" className="notice">
        <p>{loadError}</p>
        <button type="button" onClick={() => setAttempt((current) => current + 1)}>
          Try again
        </button>
      </div>
    ) : (
      <p>Loading</p>
    );
  }

  return (
    <EntityForm<ProfileForm, Draft>
      config={config}
      initial={loaded.form}
      submitLabel="Save profile"
      save={(payload) => api.put<ProfileForm>("/api/admin/profile", payload)}
      reload={reload}
      onSaved={() => {}}
    >
      {!loaded.form && <p className="notice">No profile exists yet. The first save creates it.</p>}
    </EntityForm>
  );
}
