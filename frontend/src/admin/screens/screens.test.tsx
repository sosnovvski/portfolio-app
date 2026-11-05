import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExperienceForm, MessageView, ProjectForm, SkillGroupForm } from "@/api/types";
import { createAdminApi } from "../api";
import { SessionContext } from "../session";
import { json, noContent, problem, stubServer } from "../testServer";
import { CredentialsScreen } from "./CredentialsScreen";
import { ExperiencesScreen } from "./ExperiencesScreen";
import { MessagesScreen } from "./MessagesScreen";
import { ProjectsScreen } from "./ProjectsScreen";
import { SkillGroupsScreen } from "./SkillGroupsScreen";

function renderScreen(element: ReactElement) {
  const session = { api: createAdminApi(() => {}), generation: 0, setFormDirty };
  return render(<SessionContext.Provider value={session}>{element}</SessionContext.Provider>);
}

function bodyOf(call: { body: string | null } | undefined): Record<string, unknown> {
  return JSON.parse(call?.body ?? "{}") as Record<string, unknown>;
}

const EXPERIENCE: ExperienceForm = {
  id: 1,
  version: 5,
  employer: "ALTEN",
  client: "Thales",
  roleEn: "Validation Engineer",
  rolePl: "Inżynier walidacji",
  start: "2020-06",
  end: "2021-02",
  published: true,
  achievements: [
    { textEn: "First", textPl: "Pierwsze" },
    { textEn: "Second", textPl: "Drugie" },
  ],
};

const SKILLS: SkillGroupForm = {
  id: 2,
  version: 1,
  nameEn: "CI/CD",
  namePl: "CI/CD",
  sortOrder: 4,
  skills: ["Jenkins", "Maven", "Gradle"],
};

const SAVED = "Saved. The public site shows this now.";
const UNPUBLISHED = "Saved, not published. It stays off the public site until you tick Published.";

let confirm: ReturnType<typeof vi.fn>;
const setFormDirty = vi.fn();

beforeEach(() => {
  setFormDirty.mockClear();
  confirm = vi.fn(() => true);
  vi.stubGlobal("confirm", confirm);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("list and create", () => {
  it("lists items and creates with POST, without id or version", async () => {
    const user = userEvent.setup();
    const { calls } = stubServer({
      "GET /api/admin/skill-groups": () => json([SKILLS]),
      "POST /api/admin/skill-groups": (call) => json({ ...bodyOf(call), id: 9, version: 0 }, 201),
    });
    renderScreen(<SkillGroupsScreen />);

    await screen.findByText("CI/CD");
    await user.click(screen.getByRole("button", { name: "New skill group" }));

    expect(screen.getByLabelText("Sort order (required)")).toHaveValue(5);
    await user.type(screen.getByLabelText("Name, English (required)"), "Build");
    await user.type(screen.getByLabelText("Name, Polish (required)"), "Budowanie");
    await user.click(screen.getByRole("button", { name: "Save skill group" }));

    await screen.findByText(SAVED);
    const post = calls.find((call) => call.method === "POST");
    expect(bodyOf(post)).toEqual({ nameEn: "Build", namePl: "Budowanie", sortOrder: 5, skills: [] });
    expect(screen.getByRole("button", { name: "Edit Build" })).toBeInTheDocument();
  });

  it("switches to PUT with the returned version after the first save", async () => {
    const user = userEvent.setup();
    const { calls } = stubServer({
      "GET /api/admin/skill-groups": () => json([]),
      "POST /api/admin/skill-groups": (call) => json({ ...bodyOf(call), id: 9, version: 0 }, 201),
      "PUT /api/admin/skill-groups/9": (call) => json({ ...bodyOf(call), version: 1 }),
    });
    renderScreen(<SkillGroupsScreen />);

    await user.click(await screen.findByRole("button", { name: "New skill group" }));
    await user.click(screen.getByRole("button", { name: "Save skill group" }));
    await screen.findByText(SAVED);
    await user.click(screen.getByRole("button", { name: "Save skill group" }));

    await waitFor(() => expect(calls.some((call) => call.method === "PUT")).toBe(true));
    const put = bodyOf(calls.find((call) => call.method === "PUT"));
    expect(put["id"]).toBe(9);
    expect(put["version"]).toBe(0);
  });
});

describe("errors", () => {
  async function openExperience(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Edit Validation Engineer, ALTEN" }));
  }

  it("maps endValid to the end input, describes it and focuses it", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/experiences": () => json([EXPERIENCE]),
      "PUT /api/admin/experiences/1": () =>
        problem(400, { errors: [{ field: "endValid", message: "must not be before the start month" }] }),
    });
    renderScreen(<ExperiencesScreen />);
    await openExperience(user);
    await user.click(screen.getByRole("button", { name: "Save experience" }));

    const end = screen.getByLabelText("End month");
    await waitFor(() => expect(end).toHaveFocus());
    expect(end).toHaveAttribute("aria-invalid", "true");
    const describedBy = end.getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ").map((id) => document.getElementById(id)?.textContent)).toContain(
      "must not be before the start month",
    );
  });

  it("maps nested list errors to the right row", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/experiences": () => json([EXPERIENCE]),
      "PUT /api/admin/experiences/1": () =>
        problem(400, { errors: [{ field: "achievements[1].textPl", message: "must not be blank" }] }),
    });
    renderScreen(<ExperiencesScreen />);
    await openExperience(user);
    await user.click(screen.getByRole("button", { name: "Save experience" }));

    const input = screen.getByLabelText("Achievement 2, Polish");
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Achievement 1, Polish")).not.toHaveAttribute("aria-invalid");
  });

  it("does not move focus when one of several errors is cleared by typing", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/experiences": () => json([EXPERIENCE]),
      "PUT /api/admin/experiences/1": () =>
        problem(400, {
          errors: [
            { field: "roleEn", message: "must not be blank" },
            { field: "employer", message: "must not be blank" },
          ],
        }),
    });
    renderScreen(<ExperiencesScreen />);
    await openExperience(user);
    await user.click(screen.getByRole("button", { name: "Save experience" }));

    const role = screen.getByLabelText("Role, English (required)");
    await waitFor(() => expect(role).toHaveFocus());
    await user.type(role, "x");
    expect(role).toHaveFocus();
    expect(screen.getByLabelText("Employer (required)")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows an error for an unknown field above nothing but does not lose it", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/experiences": () => json([EXPERIENCE]),
      "PUT /api/admin/experiences/1": () => problem(400, { errors: [{ field: "mystery", message: "is wrong" }] }),
    });
    renderScreen(<ExperiencesScreen />);
    await openExperience(user);
    await user.click(screen.getByRole("button", { name: "Save experience" }));

    expect(await screen.findByText("mystery: is wrong")).toBeInTheDocument();
  });

  it("on 409 says so, keeps the typed text and offers to reload", async () => {
    const user = userEvent.setup();
    let latest = EXPERIENCE;
    stubServer({
      "GET /api/admin/experiences": () => json([latest]),
      "PUT /api/admin/experiences/1": () => problem(409, { detail: "This item changed since you opened it." }),
    });
    renderScreen(<ExperiencesScreen />);
    await openExperience(user);

    const employer = screen.getByLabelText("Employer (required)");
    await user.clear(employer);
    await user.type(employer, "My typed text");
    await user.click(screen.getByRole("button", { name: "Save experience" }));

    expect(await screen.findByText(/This item changed since you opened it/)).toBeInTheDocument();
    expect(employer).toHaveValue("My typed text");

    latest = { ...EXPERIENCE, employer: "Theirs", version: 6 };
    await user.click(screen.getByRole("button", { name: "Discard my text and load the latest version" }));

    await screen.findByText("Loaded the latest version.");
    expect(employer).toHaveValue("Theirs");
  });

  it("on 404 says it was deleted, keeps the text and can save it as new", async () => {
    const user = userEvent.setup();
    const { calls } = stubServer({
      "GET /api/admin/experiences": () => json([EXPERIENCE]),
      "PUT /api/admin/experiences/1": () => problem(404),
      "POST /api/admin/experiences": (call) => json({ ...bodyOf(call), id: 2, version: 0 }, 201),
    });
    renderScreen(<ExperiencesScreen />);
    await openExperience(user);

    const employer = screen.getByLabelText("Employer (required)");
    await user.type(employer, "!");
    await user.click(screen.getByRole("button", { name: "Save experience" }));

    expect(await screen.findByText(/was deleted while you were editing/)).toBeInTheDocument();
    expect(employer).toHaveValue("ALTEN!");

    await user.click(screen.getByRole("button", { name: "Save it as a new item instead" }));
    await user.click(screen.getByRole("button", { name: "Save experience" }));

    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true));
    const body = bodyOf(calls.find((call) => call.method === "POST"));
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("version");
  });

  it("rejects a sort order that is not a whole number without calling the server", async () => {
    const user = userEvent.setup();
    const { calls } = stubServer({ "GET /api/admin/skill-groups": () => json([SKILLS]) });
    renderScreen(<SkillGroupsScreen />);

    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));
    await user.clear(screen.getByLabelText("Sort order (required)"));
    await user.click(screen.getByRole("button", { name: "Save skill group" }));

    expect(screen.getByLabelText("Sort order (required)")).toHaveFocus();
    expect(screen.getByLabelText("Sort order (required)")).toHaveAttribute("aria-invalid", "true");
    expect(calls.some((call) => call.method === "PUT")).toBe(false);
  });
});

describe("reordering", () => {
  it("stores the list in the order shown, keeps focus and announces the move", async () => {
    const user = userEvent.setup();
    const { calls } = stubServer({
      "GET /api/admin/skill-groups": () => json([SKILLS]),
      "PUT /api/admin/skill-groups/2": (call) => json({ ...bodyOf(call), version: 2 }),
    });
    renderScreen(<SkillGroupsScreen />);

    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));
    await user.click(screen.getByRole("button", { name: 'Move "Gradle" up' }));

    expect(screen.getByLabelText("Skill 2")).toHaveValue("Gradle");
    expect(screen.getByRole("button", { name: 'Move "Gradle" up' })).toHaveFocus();
    expect(screen.getByText('Moved "Gradle" to position 2 of 3.')).toHaveAttribute("role", "status");

    await user.click(screen.getByRole("button", { name: "Save skill group" }));
    await waitFor(() => expect(calls.some((call) => call.method === "PUT")).toBe(true));
    expect(bodyOf(calls.find((call) => call.method === "PUT"))["skills"]).toEqual(["Jenkins", "Gradle", "Maven"]);
  });

  it("moves focus to the other direction at the end of the list", async () => {
    const user = userEvent.setup();
    stubServer({ "GET /api/admin/skill-groups": () => json([SKILLS]) });
    renderScreen(<SkillGroupsScreen />);

    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));
    await user.click(screen.getByRole("button", { name: 'Move "Maven" up' }));

    expect(screen.getByRole("button", { name: 'Move "Maven" up' })).toBeDisabled();
    expect(screen.getByRole("button", { name: 'Move "Maven" down' })).toHaveFocus();
  });

  it("adds and removes rows, focusing sensibly", async () => {
    const user = userEvent.setup();
    stubServer({ "GET /api/admin/skill-groups": () => json([SKILLS]) });
    renderScreen(<SkillGroupsScreen />);

    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));
    await user.click(screen.getByRole("button", { name: "Add skill" }));
    expect(screen.getByLabelText("Skill 4")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: 'Remove "Jenkins"' }));
    expect(screen.getByLabelText("Skill 1")).toHaveValue("Maven");
    expect(screen.getByRole("button", { name: 'Remove "Maven"' })).toHaveFocus();
  });

  it("sends achievements in both languages in the shown order, without list keys", async () => {
    const user = userEvent.setup();
    const { calls } = stubServer({
      "GET /api/admin/experiences": () => json([EXPERIENCE]),
      "PUT /api/admin/experiences/1": (call) => json({ ...bodyOf(call), version: 6 }),
    });
    renderScreen(<ExperiencesScreen />);

    await user.click(await screen.findByRole("button", { name: "Edit Validation Engineer, ALTEN" }));
    await user.click(screen.getByRole("button", { name: 'Move "Second" up' }));
    await user.click(screen.getByRole("button", { name: "Save experience" }));

    await waitFor(() => expect(calls.some((call) => call.method === "PUT")).toBe(true));
    expect(bodyOf(calls.find((call) => call.method === "PUT"))["achievements"]).toEqual([
      { textEn: "Second", textPl: "Drugie" },
      { textEn: "First", textPl: "Pierwsze" },
    ]);
  });
});

describe("delete", () => {
  it("confirms naming the item, then removes it", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/skill-groups": () => json([SKILLS]),
      "DELETE /api/admin/skill-groups/2": () => noContent(),
    });
    renderScreen(<SkillGroupsScreen />);

    await user.click(await screen.findByRole("button", { name: "Delete CI/CD" }));

    expect(confirm).toHaveBeenCalledWith('Delete "CI/CD"? This cannot be undone.');
    expect(await screen.findByText('Deleted "CI/CD".')).toHaveAttribute("role", "status");
    expect(screen.queryByRole("button", { name: "Edit CI/CD" })).toBeNull();
  });

  it("does nothing when the confirmation is declined", async () => {
    const user = userEvent.setup();
    confirm.mockReturnValue(false);
    const { calls } = stubServer({ "GET /api/admin/skill-groups": () => json([SKILLS]) });
    renderScreen(<SkillGroupsScreen />);

    await user.click(await screen.findByRole("button", { name: "Delete CI/CD" }));

    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(screen.getByRole("button", { name: "Edit CI/CD" })).toBeInTheDocument();
  });

  it("asks before discarding unsaved text when opening another item", async () => {
    const user = userEvent.setup();
    stubServer({ "GET /api/admin/skill-groups": () => json([SKILLS, { ...SKILLS, id: 3, nameEn: "Other" }]) });
    renderScreen(<SkillGroupsScreen />);

    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));
    const name = screen.getByLabelText("Name, English (required)");
    await user.type(name, " changed");

    confirm.mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "Edit Other" }));

    expect(confirm).toHaveBeenCalledWith("You have unsaved changes. Discard them?");
    expect(name).toHaveValue("CI/CD changed");
  });
});

describe("after a save", () => {
  it("updates the heading after a create and after a rename, without touching the text", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/skill-groups": () => json([]),
      "POST /api/admin/skill-groups": (call) => json({ ...bodyOf(call), id: 9, version: 0 }, 201),
      "PUT /api/admin/skill-groups/9": (call) => json({ ...bodyOf(call), version: 1 }),
    });
    renderScreen(<SkillGroupsScreen />);

    await user.click(await screen.findByRole("button", { name: "New skill group" }));
    expect(screen.getByRole("heading", { level: 2, name: "New skill group" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name, English (required)"), "Build");
    await user.click(screen.getByRole("button", { name: "Save skill group" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Edit Build" })).toBeInTheDocument();

    const name = screen.getByLabelText("Name, English (required)");
    await user.type(name, " tools");
    await user.click(screen.getByRole("button", { name: "Save skill group" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Edit Build tools" })).toBeInTheDocument();
    expect(name).toHaveValue("Build tools");
  });

  it("says a published item is public now", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/experiences": () => json([EXPERIENCE]),
      "PUT /api/admin/experiences/1": (call) => json({ ...bodyOf(call), version: 6 }),
    });
    renderScreen(<ExperiencesScreen />);
    await user.click(await screen.findByRole("button", { name: "Edit Validation Engineer, ALTEN" }));
    await user.click(screen.getByRole("button", { name: "Save experience" }));
    expect(await screen.findByText(SAVED)).toHaveAttribute("role", "status");
  });

  it("says an unpublished item stays off the site", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/experiences": () => json([{ ...EXPERIENCE, published: false }]),
      "PUT /api/admin/experiences/1": (call) => json({ ...bodyOf(call), version: 6 }),
    });
    renderScreen(<ExperiencesScreen />);
    await user.click(await screen.findByRole("button", { name: "Edit Validation Engineer, ALTEN" }));
    await user.click(screen.getByRole("button", { name: "Save experience" }));
    expect(await screen.findByText(UNPUBLISHED)).toHaveAttribute("role", "status");
  });

  it("does not stick on Saving when the body read fails", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/skill-groups": () => json([SKILLS]),
      "PUT /api/admin/skill-groups/2": () =>
        ({ ok: true, status: 200, text: () => Promise.reject(new TypeError("dropped")) }) as unknown as Response,
    });
    renderScreen(<SkillGroupsScreen />);
    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));
    await user.click(screen.getByRole("button", { name: "Save skill group" }));

    expect(await screen.findByText(/Could not reach the server/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save skill group" })).toBeEnabled();
  });

  it("shows the refusal text on a 403 after the retry", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/skill-groups": () => json([SKILLS]),
      "PUT /api/admin/skill-groups/2": () => problem(403, { detail: "Reload the page and try again." }),
    });
    renderScreen(<SkillGroupsScreen />);
    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));
    await user.click(screen.getByRole("button", { name: "Save skill group" }));

    expect(await screen.findByText(/Copy it somewhere safe before reloading the page/)).toBeInTheDocument();
    expect(screen.queryByText(/Reload the page and try again/)).toBeNull();
  });
});

describe("the action row", () => {
  it("keeps Save, the saved status and Close editor together", async () => {
    const user = userEvent.setup();
    stubServer({ "GET /api/admin/skill-groups": () => json([SKILLS]) });
    const { container } = renderScreen(<SkillGroupsScreen />);
    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));

    const row = container.querySelector(".form-actions") as HTMLElement;
    expect(within(row).getByRole("button", { name: "Save skill group" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Close editor" })).toHaveAttribute("type", "button");
    expect(within(row).getByRole("status")).toBeInTheDocument();
  });
});

describe("dirty state", () => {
  it("is reported from inside the form, keyed by id, and cleared after a save and on close", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/skill-groups": () => json([SKILLS]),
      "PUT /api/admin/skill-groups/2": (call) => json({ ...bodyOf(call), version: 2 }),
    });
    const { unmount } = renderScreen(<SkillGroupsScreen />);
    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));

    await user.type(screen.getByLabelText("Name, English (required)"), "x");
    const [id] = setFormDirty.mock.lastCall as [string, boolean];
    expect(setFormDirty).toHaveBeenLastCalledWith(id, true);

    await user.click(screen.getByRole("button", { name: "Save skill group" }));
    await screen.findByText(SAVED);
    expect(setFormDirty).toHaveBeenLastCalledWith(id, false);

    await user.type(screen.getByLabelText("Name, English (required)"), "y");
    expect(setFormDirty).toHaveBeenLastCalledWith(id, true);
    unmount();
    expect(setFormDirty).toHaveBeenLastCalledWith(id, false);
  });
});

describe("focus after a notice's button goes away", () => {
  it("moves to Save after loading the latest version, with a note to copy the text first", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/skill-groups": () => json([SKILLS]),
      "PUT /api/admin/skill-groups/2": () => problem(409, { detail: "Changed." }),
    });
    renderScreen(<SkillGroupsScreen />);
    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));
    await user.click(screen.getByRole("button", { name: "Save skill group" }));

    expect(await screen.findByText("Copy your text first if you want to keep it.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Discard my text and load the latest version" }));

    await screen.findByText("Loaded the latest version.");
    expect(screen.getByRole("button", { name: "Save skill group" })).toHaveFocus();
  });

  it("moves to Save after choosing to save as new", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/skill-groups": () => json([SKILLS]),
      "PUT /api/admin/skill-groups/2": () => problem(404),
    });
    renderScreen(<SkillGroupsScreen />);
    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));
    await user.click(screen.getByRole("button", { name: "Save skill group" }));
    await user.click(await screen.findByRole("button", { name: "Save it as a new item instead" }));

    expect(screen.getByRole("button", { name: "Save skill group" })).toHaveFocus();
  });
});

describe("reorder names", () => {
  it("fall back to the position for an empty row and shorten long text", async () => {
    const user = userEvent.setup();
    const long = "a".repeat(60);
    stubServer({ "GET /api/admin/skill-groups": () => json([{ ...SKILLS, skills: [long, "Maven"] }]) });
    renderScreen(<SkillGroupsScreen />);
    await user.click(await screen.findByRole("button", { name: "Edit CI/CD" }));

    expect(screen.getByRole("button", { name: `Remove "${"a".repeat(40)}…"` })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add skill" }));
    expect(screen.getByRole("button", { name: "Remove skill 3" })).toBeInTheDocument();
  });
});

describe("credentials", () => {
  it("maps endYearValid to the end year and offers the required kind", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/admin/credentials": () =>
        json([{ id: 1, version: 1, kind: "EDUCATION", titleEn: "Degree", titlePl: "Dyplom", issuer: "UMG", sortOrder: 0, startYear: 2014, endYear: 2018 }]),
      "PUT /api/admin/credentials/1": () =>
        problem(400, { errors: [{ field: "endYearValid", message: "must not be before the start year" }] }),
    });
    renderScreen(<CredentialsScreen />);

    await user.click(await screen.findByRole("button", { name: "Edit Degree" }));
    expect(screen.getByLabelText("Kind (required)")).toHaveValue("EDUCATION");
    await user.click(screen.getByRole("button", { name: "Save credential" }));

    const endYear = screen.getByLabelText("End year");
    await waitFor(() => expect(endYear).toHaveFocus());
    expect(endYear).toHaveAttribute("aria-invalid", "true");
  });
});

describe("projects", () => {
  it("explains when a project is public, and sends required fields", async () => {
    const user = userEvent.setup();
    const { calls } = stubServer({
      "GET /api/admin/projects": () => json([] as ProjectForm[]),
      "POST /api/admin/projects": (call) => json({ ...bodyOf(call), id: 1, version: 0 }, 201),
    });
    renderScreen(<ProjectsScreen />);

    expect(screen.getByText(/appears publicly only when it is published/)).toBeInTheDocument();
    expect(screen.getByText(/section stays hidden while none is\s+published/)).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "New project" }));
    await user.click(screen.getByRole("button", { name: "Save project" }));

    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true));
    expect(bodyOf(calls.find((call) => call.method === "POST"))).toMatchObject({
      status: "PLANNED",
      published: false,
      sortOrder: 0,
      tech: [],
    });
  });
});

describe("messages", () => {
  const MESSAGE: MessageView = {
    id: 5,
    name: "Ada <b>Lovelace</b>",
    email: "ada+x@example.com",
    locale: "pl",
    message: "<script>alert(1)</script>\nSecond line",
    createdAt: "2026-11-05T10:00:00Z",
  };

  function page(items: MessageView[], total = items.length, number = 0) {
    return { items, page: number, size: 20, total };
  }

  it("shows the text as plain text and encodes the reply address", async () => {
    stubServer({ "GET /api/admin/messages": () => json(page([MESSAGE])) });
    const { container } = renderScreen(<MessagesScreen />);

    const body = await screen.findByText(/alert\(1\)/);
    expect(body.textContent).toBe(MESSAGE.message);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByRole("link", { name: MESSAGE.email })).toHaveAttribute(
      "href",
      "mailto:ada%2Bx@example.com",
    );
  });

  it("requests a page and moves between pages", async () => {
    const user = userEvent.setup();
    const { calls } = stubServer({
      "GET /api/admin/messages?page=0": () => json(page([MESSAGE], 25)),
      "GET /api/admin/messages?page=1": () => json(page([{ ...MESSAGE, id: 6, name: "Older" }], 25, 1)),
    });
    renderScreen(<MessagesScreen />);

    await screen.findByText("Page 1 of 2", { selector: "span" });
    expect(calls[0]?.url).toBe("/api/admin/messages?page=0&size=20");
    expect(screen.getByRole("button", { name: "Newer" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Older" }));
    await screen.findByText("Page 2 of 2", { selector: "span" });
    expect(await screen.findByText("Page 2 of 2", { selector: '[role="status"]' })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Older" })).toBeDisabled();
  });

  it("toggles read through PATCH", async () => {
    const user = userEvent.setup();
    const { calls } = stubServer({
      "GET /api/admin/messages": () => json(page([MESSAGE])),
      "PATCH /api/admin/messages/5": (call) =>
        json({ ...MESSAGE, ...(bodyOf(call)["read"] ? { readAt: "2026-11-05T11:00:00Z" } : {}) }),
    });
    renderScreen(<MessagesScreen />);

    await screen.findByText("unread");
    await user.click(screen.getByRole("button", { name: `Mark as read: message from ${MESSAGE.name}` }));

    await screen.findByRole("button", { name: `Mark as unread: message from ${MESSAGE.name}` });
    expect(bodyOf(calls.find((call) => call.method === "PATCH"))).toEqual({ read: true });
    expect(screen.queryByText("unread")).toBeNull();
  });

  it("names buttons with the visible words first", async () => {
    stubServer({ "GET /api/admin/messages": () => json(page([MESSAGE])) });
    renderScreen(<MessagesScreen />);
    expect(await screen.findByRole("button", { name: `Mark as read: message from ${MESSAGE.name}` })).toHaveTextContent("Mark as read");
    expect(screen.getByRole("button", { name: `Delete: message from ${MESSAGE.name}` })).toHaveTextContent("Delete");
  });

  it("confirms before deleting and reloads the page", async () => {
    const user = userEvent.setup();
    let items = [MESSAGE];
    stubServer({
      "GET /api/admin/messages": () => json(page(items)),
      "DELETE /api/admin/messages/5": () => {
        items = [];
        return noContent();
      },
    });
    renderScreen(<MessagesScreen />);

    const item = (await screen.findByText(/alert\(1\)/)).closest("article") as HTMLElement;
    await user.click(within(item).getByRole("button", { name: /^Delete/ }));

    expect(confirm).toHaveBeenCalledWith(`Delete the message from ${MESSAGE.name}? This cannot be undone.`);
    expect(await screen.findByText("No messages.")).toBeInTheDocument();
  });
});
