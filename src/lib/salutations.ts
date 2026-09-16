export type SalutationPeriod = "morning" | "afternoon" | "evening";

const NAME_PRONUNCIATIONS: Record<string, string> = {
  akanimoh: "ah-KAH-nee-moh",
  morpheos: "MOR-fee-us",
};

export function phoneticName(name: string): string {
  const trimmed = name.trim();
  return NAME_PRONUNCIATIONS[trimmed.toLowerCase()] ?? trimmed;
}

export function getSalutationPeriod(date = new Date()): SalutationPeriod {
  const hour = Number(new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }).format(date));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function generateSalutation(options: { name?: string; hasPriorSession?: boolean; date?: Date } = {}): string {
  const name = options.name?.trim() || "there";
  const spokenName = phoneticName(name);
  const period = getSalutationPeriod(options.date);
  if (options.hasPriorSession) {
    return `hey ${spokenName}, let's look at the traction metrics from your last session.`;
  }
  return `good ${period} ${spokenName}, ready to run your deck numbers?`;
}

export function normalizeNamesForSpeech(text: string): string {
  return Object.entries(NAME_PRONUNCIATIONS).reduce(
    (result, [name, pronunciation]) => result.replace(new RegExp(`\\b${name}\\b`, "gi"), pronunciation),
    text,
  );
}
