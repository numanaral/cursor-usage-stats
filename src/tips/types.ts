export const TipCategory = {
  Cursor: "cursor",
  AiGeneral: "ai-general",
  Productivity: "productivity",
} as const;

export type TipCategoryType = (typeof TipCategory)[keyof typeof TipCategory];

export interface Tip {
  title: string;
  description: string;
  category: TipCategoryType;
}
