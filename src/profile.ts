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
  /** 当前身份：高中生 / 大学生 / 研究生 / 已毕业或工作 */
  identity: string;
  /** 院校层次：985 / 211 / 双一流 / 普通本科 … */
  schoolLevel: string;
  /** 目标方向，例如「找暑期实习」「考研」 */
  direction: string;
  /** 所在城市 */
  city: string;
  /** 兴趣方向，例如「产品设计、数据分析」 */
  interest: string;
  companionType: CompanionType;
  tone: CompanionTone;
  temperature: number;
  responseLength: ResponseLength;
  persona: string;
};

export const GRADES = ["大一", "大二", "大三", "大四", "研究生", "其他"];
export const IDENTITIES = ["高中生", "大学生", "研究生", "已毕业或工作"];
export const SCHOOL_LEVELS = [
  "985",
  "211",
  "双一流",
  "普通本科",
  "民办本科",
  "专科",
  "海外院校",
  "其他",
];
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
  identity: "",
  schoolLevel: "",
  direction: "",
  city: "",
  interest: "",
  companionType: "朋友",
  tone: "幽默",
  temperature: 0.8,
  responseLength: "短",
  persona: "",
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
    identity: IDENTITIES.includes(String(input.identity))
      ? String(input.identity)
      : "",
    schoolLevel: SCHOOL_LEVELS.includes(String(input.schoolLevel))
      ? String(input.schoolLevel)
      : "",
    direction:
      typeof input.direction === "string" ? input.direction.slice(0, 80) : "",
    city: typeof input.city === "string" ? input.city.slice(0, 40) : "",
    interest:
      typeof input.interest === "string" ? input.interest.slice(0, 120) : "",
    companionType,
    tone,
    temperature,
    responseLength,
    persona:
      typeof input.persona === "string" ? input.persona.slice(0, 1500) : "",
  };
}
