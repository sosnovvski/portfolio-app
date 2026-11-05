import type { Experience, Profile } from "@/api/types";
import type { YearMonth } from "@/lib/dates";
import { CareerTimeline } from "./CareerTimeline";

/** Breaks after the first word for the display size; the space keeps the text correct for assistive tech. */
function DisplayName({ fullName }: { fullName: string }) {
  const separator = fullName.indexOf(" ");
  if (separator < 0) {
    return <h1>{fullName}</h1>;
  }
  return (
    <h1>
      {fullName.slice(0, separator)} <br />
      {fullName.slice(separator + 1)}
    </h1>
  );
}

export function Hero({
  profile,
  experiences,
  now,
}: {
  profile: Profile;
  experiences: readonly Experience[];
  now: YearMonth;
}) {
  return (
    <div className="hero">
      <DisplayName fullName={profile.fullName} />
      <p className="headline">{profile.headline}</p>
      <p className="muted location">{profile.location}</p>
      {experiences.length > 0 && <CareerTimeline experiences={experiences} now={now} />}
    </div>
  );
}
