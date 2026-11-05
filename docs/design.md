# Design system: "test report"

Mockup: `docs/design-mockup.html`. Open it in a browser. It loads fonts from Google for convenience; the real site self-hosts them through `next/font`.

## Audience and job
Two readers: a recruiter who needs employer, role and dates within seconds, and an engineer who should recognise the world of test reports. The metaphor serves the second reader and must never slow down the first.

## Signature element
The career run timeline: one row per role, with a bar placed on a real time axis, as in the timeline view of a test report. Bar geometry comes only from the role's dates. Everything else stays quiet.

## Colour
Dark petrol rather than near-black, so the page does not read as a default terminal theme.

| Token | Hex | Role | On `bg` | On `surface` |
|---|---|---|---|---|
| `bg` | #0F2229 | Page | | |
| `surface` | #17303A | Inputs, CI panel | | |
| `line` | #2F505C | Row dividers, axis (decorative) | 1.89 | 1.59 |
| `text` | #EFEADF | Body and headings | 13.66 | 11.51 |
| `muted` | #A9B8BA | Secondary facts | 8.00 | 6.74 |
| `pass` | #7FE0B0 | Finished role, passed run | 10.30 | 8.68 |
| `running` | #F2B84B | Current role | 9.16 | 7.72 |
| `link` | #A9C1FF | Links, focus ring | 9.18 | 7.73 |
| `fail` | #FF9C8F | Real CI failures and form errors, never on career entries | 8.12 | 6.84 |

Ratios are computed. Inputs use a `muted` border because `line` is below 3:1 and form controls need it.

## Type
- **Schibsted Grotesk** for all facts and headings. Name set at weight 800, up to 8.5rem, tight tracking.
- **Martian Mono** only for what a test runner would print: status labels and axis years.
- Both families need `latin` and `latin-ext`, for names such as Gdańsk.
- Body 1.0625rem at line-height 1.6; prose kept under 44rem.

## Layout
- Left aligned on a 72rem column.
- Hero: name, headline, location, then the timeline. The owner removed the terminal command line.
- The first timeline row must be visible at 1366x768, so a recruiter sees a role, employer and dates without scrolling.
- Timeline rows state employer and the date range as text. Bars never carry the only copy of a date.
- Experience: a gutter with status, date range and duration beside the plain role, employer and client. Each role is its own article, with the `h3` first in the DOM and the status placed in the gutter by CSS.
- Timeline is an ordered list of links, newest first.
- Below 720px, timeline labels sit above their bars and the status moves above the role.

## Form states
- All fields required, stated above the first field.
- Errors: text linked with `aria-describedby`, `aria-invalid` on the field, focus moved to the first invalid field.
- Sending: button disabled and labelled "Sending".
- Success: `role="status"` text "Message sent". Failure: says what happened and what to do next.

## Rules for the metaphor
1. Role, employer, client and dates are normal text in server-rendered HTML, readable without JavaScript.
2. No fact appears only in decoration.
3. Status is always text as well as colour, and a legend explains it.
4. Career entries are PASS or RUNNING only. Numbers are real: "8 roles", never invented test counts.
5. The CI panel is visually separate from career statuses and shows real results only.

## Motion
Two moments, nothing else moves unprompted:
- **Load:** the timeline bars grow in chronological order, about 1.3s in total, using CSS only.
- **Scroll (owner request):** Experience records slide in from right to left as they enter the viewport, once each, staggered by 120ms when several enter together. An `IntersectionObserver` drives it.

The hidden starting state applies only after a script adds the `reveal` class, so without JavaScript all content is visible. `prefers-reduced-motion` removes both effects, and print always shows the records. `overflow-x: clip` on the section prevents a horizontal scrollbar. E2E tests must scroll to a record before asserting it is visible.

## Implementation constraints
- Strict CSP: no `style=""` attributes in server-rendered HTML. Bars are SVG `rect` elements positioned with `x` and `width`.
- The axis spans from January of the first role's year to the end of the current year, and is computed from data. The mockup uses 120 months from January 2017.
- Pointer targets at least 24x24 CSS px, primary button 44px high, visible focus ring.
- Print stylesheet: black on white, facts only. Hides the header, timeline, CI section and form.
- Projects section is hidden until a project is published. The CI section is hidden when data is missing.

## Draft copy needing owner approval
Headline chosen by the owner: "Senior QA Automation / Software Engineer / Test Lead". The hero sentence "I build test frameworks that teams can trust at release time" is not from the CV. The self-employed and EPAM roles have no details in the source. All experience text is a language-corrected draft of `Profile.pdf`.
