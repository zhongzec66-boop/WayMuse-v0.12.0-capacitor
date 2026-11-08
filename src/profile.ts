export type CompanionType = "朋友" | "导师" | "自定义";
export type CompanionTone = "温柔" | "直接" | "幽默" | "冷静" | "鼓励";
export type ResponseLength = "短" | "中" | "长";

export type UserProfile = {
  callName: string;
  avatar: string;
  school: string;
  major: string;
  grade: string;
  courses: string;
  companionType: CompanionType;
  tone: CompanionTone;
  temperature: number;
  responseLength: ResponseLength;
};

export const GRADES = ["大一", "大二", "大三", "大四", "研究生", "其他"];
export const COMPANION_TYPES: CompanionType[] = ["朋友", "导师", "自定义"];
export const TONES: CompanionTone[] = ["温柔", "直接", "幽默", "冷静", "鼓励"];
export const RESPONSE_LENGTHS: ResponseLength[] = ["短", "中", "长"];

export const COMPANION_PRESETS: Record<
  Exclude<CompanionType, "自定义">,
  { tone: CompanionTone; temperature: number; responseLength: ResponseLength }
> = {
  朋友: { tone: "幽默", temperature: 0.8, responseLength: "短" },
  导师: { tone: "直接", temperature: 0.4, responseLength: "短" },
};

export const DEFAULT_PROFILE: UserProfile = {
  callName: "",
  avatar: "",
  school: "",
  major: "",
  grade: "大一",
  courses: "",
  companionType: "朋友",
  tone: "幽默",
  temperature: 0.8,
  responseLength: "短",
};

export function responseTokenBudget(length: ResponseLength): number {
  if (length === "短") return 700;
  if (length === "长") return 2600;
  return 1400;
}

export function normalizeProfile(value: unknown): UserProfile {
  if (typeof value !== "object" || value === null)
    return { ...DEFAULT_PROFILE };
  const input = value as Record<string, unknown>;
  const companionType = COMPANION_TYPES.includes(
    input.companionType as CompanionType,
  )
    ? (input.companionType as CompanionType)
    : DEFAULT_PROFILE.companionType; // Removed values fall back to 朋友.
  const tone = TONES.includes(input.tone as CompanionTone)
    ? (input.tone as CompanionTone)
    : DEFAULT_PROFILE.tone;
  const responseLength = RESPONSE_LENGTHS.includes(
    input.responseLength as ResponseLength,
  )
    ? (input.responseLength as ResponseLength)
    : DEFAULT_PROFILE.responseLength;
  const temperature =
    typeof input.temperature === "number" &&
    input.temperature >= 0 &&
    input.temperature <= 2
      ? input.temperature
      : DEFAULT_PROFILE.temperature;
  const avatar =
    typeof input.avatar === "string" &&
    input.avatar.startsWith("data:image/") &&
    input.avatar.length < 500_000
      ? input.avatar
      : "";
  return {
    callName:
      typeof input.callName === "string"
        ? input.callName.slice(0, 24)
        : DEFAULT_PROFILE.callName,
    avatar,
    school:
      typeof input.school === "string"
        ? input.school.slice(0, 80)
        : DEFAULT_PROFILE.school,
    major:
      typeof input.major === "string"
        ? input.major.slice(0, 80)
        : DEFAULT_PROFILE.major,
    grade:
      typeof input.grade === "string" && GRADES.includes(input.grade)
        ? input.grade
        : DEFAULT_PROFILE.grade,
    courses:
      typeof input.courses === "string"
        ? input.courses.slice(0, 600)
        : DEFAULT_PROFILE.courses,
    companionType,
    tone,
    temperature,
    responseLength,
  };
}
