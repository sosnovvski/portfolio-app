import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderIn } from "@/test/render";
import { ContactForm } from "./ContactForm";

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Ada");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Message"), "A long enough message.");
}

function stubFetch(response: Response | Error) {
  const mock =
    response instanceof Error ? vi.fn().mockRejectedValue(response) : vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("contact form", () => {
  it("states that all fields are required", () => {
    renderIn("en", <ContactForm />);
    expect(screen.getByText("All fields are required.")).toBeInTheDocument();
  });

  it("marks invalid fields, links the error text, focuses the first and does not send", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(new Response(null, { status: 202 }));
    renderIn("en", <ContactForm />);

    await user.type(screen.getByLabelText("Email"), "nope");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    const name = screen.getByLabelText("Name");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("aria-describedby", "contact-name-error");
    expect(document.getElementById("contact-name-error")).toHaveTextContent("Enter your name.");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("contact-email-error")).toHaveTextContent("name@example.com");
    expect(document.getElementById("contact-message-error")).toHaveTextContent("Enter your message.");
    expect(name).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends trimmed values with the locale and an empty honeypot, shows Sending, then success", async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderIn("pl", <ContactForm />);

    await user.type(screen.getByLabelText("Imię i nazwisko"), "  Ada ");
    await user.type(screen.getByLabelText("E-mail"), "ada@example.com");
    await user.type(screen.getByLabelText("Wiadomość"), "Dość długa wiadomość.");
    await user.click(screen.getByRole("button", { name: "Wyślij wiadomość" }));

    expect(screen.getByRole("button", { name: "Wysyłanie" })).toBeDisabled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/contact");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Ada",
      email: "ada@example.com",
      message: "Dość długa wiadomość.",
      locale: "pl",
      contactRef: "",
    });

    release(new Response(null, { status: 202 }));

    expect(await screen.findByText("Wiadomość została wysłana.")).toHaveAttribute("role", "status");
    expect(screen.getByLabelText("Wiadomość")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Wyślij wiadomość" })).toBeEnabled();
  });

  it("maps server field errors to fields, in the page language, and focuses the first", async () => {
    const user = userEvent.setup();
    stubFetch(Response.json({ errors: [{ field: "email", message: "must be well formed" }] }, { status: 400 }));
    renderIn("pl", <ContactForm />);

    await user.type(screen.getByLabelText("Imię i nazwisko"), "Ada");
    await user.type(screen.getByLabelText("E-mail"), "ada@example");
    await user.type(screen.getByLabelText("Wiadomość"), "Dość długa wiadomość.");
    await user.click(screen.getByRole("button", { name: "Wyślij wiadomość" }));

    const email = screen.getByLabelText("E-mail");
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "contact-email-error");
    expect(document.getElementById("contact-email-error")).toHaveTextContent("Serwer nie przyjął tego adresu e-mail");
    expect(screen.getByLabelText("Imię i nazwisko")).not.toHaveAttribute("aria-invalid");
  });

  it("clears a field's error when it is edited", async () => {
    const user = userEvent.setup();
    renderIn("en", <ContactForm />);
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await user.type(screen.getByLabelText("Name"), "A");
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
    expect(document.getElementById("contact-name-error")).toBeNull();
  });

  it("keeps focus in the field being corrected when another field is still invalid", async () => {
    const user = userEvent.setup();
    renderIn("en", <ContactForm />);
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await user.type(screen.getByLabelText("Name"), "Ada");
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(screen.getByLabelText("Name")).toHaveValue("Ada");
  });

  it("tells the wait on 429 and keeps the text", async () => {
    const user = userEvent.setup();
    stubFetch(new Response(null, { status: 429, headers: { "Retry-After": "300" } }));
    renderIn("en", <ContactForm />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in 5 minutes.");
    expect(screen.getByLabelText("Message")).toHaveValue("A long enough message.");
  });

  it("clears Message sent as soon as a second message is typed", async () => {
    const user = userEvent.setup();
    stubFetch(new Response(null, { status: 202 }));
    renderIn("en", <ContactForm />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Message sent");

    await user.type(screen.getByLabelText("Name"), "B");

    expect(screen.queryByText("Message sent")).toBeNull();
  });

  it("keeps a failure on screen while the visitor corrects the text", async () => {
    const user = userEvent.setup();
    stubFetch(new TypeError("failed"));
    renderIn("en", <ContactForm />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText(/Check your connection/);

    await user.type(screen.getByLabelText("Message"), "!");

    expect(screen.getByText(/Check your connection/)).toBeInTheDocument();
  });

  it("tells the wait in Polish", async () => {
    const user = userEvent.setup();
    stubFetch(new Response(null, { status: 429, headers: { "Retry-After": "300" } }));
    renderIn("pl", <ContactForm />);
    await user.type(screen.getByLabelText("Imię i nazwisko"), "Ada");
    await user.type(screen.getByLabelText("E-mail"), "ada@example.com");
    await user.type(screen.getByLabelText("Wiadomość"), "Dość długa wiadomość.");
    await user.click(screen.getByRole("button", { name: "Wyślij wiadomość" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Spróbuj ponownie za 5 minut."));
  });

  it("says what to do next when the network fails", async () => {
    const user = userEvent.setup();
    stubFetch(new TypeError("failed"));
    renderIn("en", <ContactForm />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Check your connection and try again."));
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
  });

  it("hides the honeypot from people and assistive tech", () => {
    const { container } = renderIn("en", <ContactForm />);
    const honeypot = container.querySelector('input[name="contact_ref"]') as HTMLInputElement;
    expect(container.querySelector('input[name="website"]')).toBeNull();
    expect(honeypot).toHaveAttribute("data-1p-ignore");
    expect(honeypot).toHaveAttribute("data-lpignore", "true");
    expect(honeypot).toHaveAttribute("data-bwignore");
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
    expect(honeypot.closest(".hp")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("textbox", { name: "Reference" })).toBeNull();
  });
});
