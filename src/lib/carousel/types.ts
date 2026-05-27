export type TransitionMode = "shatter-particle" | "curtain-fade";

export interface CarouselAngle {
  id: string;
  itemId: string;
  angleKey: string;
  imagePath: string;
  angleOrder: number;
}

export interface CachedTechSpecs {
  specs: Array<{ heading: string; items: Array<{ label: string; value: string }> }>;
  colors: Array<{ name: string; hex: string | null; swatchUrl: string | null }>;
}

export interface CarouselItem {
  id: string;
  title: string;
  description: string | null;
  catalogNumber?: string | null;
  sourceUrl?: string | null;
  coverImagePath: string;
  displayOrder: number;
  isActive: boolean;
  angles: CarouselAngle[];
  techSpecs?: CachedTechSpecs | null;
}

export interface CarouselSettings {
  autoplayMs: number;
  transitionMode: TransitionMode;
}

export interface CarouselPayload {
  items: CarouselItem[];
  settings: CarouselSettings;
}

export interface AdminItemInput {
  id?: string;
  title: string;
  description?: string | null;
  catalogNumber?: string | null;
  sourceUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
  coverImagePath: string;
  angles: Array<{
    id?: string;
    angleKey: string;
    angleOrder: number;
    imagePath: string;
  }>;
}
