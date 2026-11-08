/**
 * Breeze 可选音色。
 *
 * 说明都是官方给的原文要点，只做了删减，用来帮用户选，
 * 不是我们自己编的形容词。
 */

export type VoicePreset = {
  id: string;
  name: string;
  desc: string;
};

export const VOICES: VoicePreset[] = [
  {
    id: "voc_rgr8satyqpwh",
    name: "青葱电台",
    desc: "清脆悦耳，带少年感的青涩和活力，语调亲和。适合校园、青春题材。",
  },
  {
    id: "voc_b86bfwct4cjn",
    name: "香农小姐",
    desc: "清冷疏离的年轻女声，表达清晰，语气克制有条理。",
  },
  {
    id: "voc_88a7brnfb4tb",
    name: "御姐",
    desc: "成熟稳的成年女声，气场足。",
  },
  {
    id: "voc_wkzpcy2xxwch",
    name: "寒蝉余音",
    desc: "克制的中低音，略带疲惫的沙哑里透着坚韧。适合都市、剧情类。",
  },
  {
    id: "voc_5cemd59kz4cz",
    name: "冰下弦音",
    desc: "清澈带悠长共鸣，语速偏慢，空灵感强。适合旁白、独白。",
  },
  {
    id: "voc_s82r6hy73jkt",
    name: "守木匠心",
    desc: "低沉温和，咬字圆润，节奏舒缓。适合纪录片、治愈系。",
  },
  {
    id: "voc_gbaz4j9uyq97",
    name: "幽巷引路人",
    desc: "深沉低频，呼吸克制，语速舒缓。适合悬疑、反派类。",
  },
  {
    id: "voc_pmkjwbcphjdr",
    name: "狡黠猎犬",
    desc: "沙哑干涩的颗粒感，语速敏捷，节奏调皮。适合游戏配角。",
  },
];

/** 默认用「青葱电台」：这是给学生用的陪伴应用， youthful 更贴。 */
export const DEFAULT_VOICE_ID = "voc_rgr8satyqpwh";

export function voiceName(id: string): string {
  return VOICES.find((voice) => voice.id === id)?.name ?? id;
}
