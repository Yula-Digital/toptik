import { z } from "zod";

export const carouselSettingsSchema = z.object({
  autoplayMs: z.number().int().min(1500).max(12000),
  transitionMode: z.enum(["shatter-particle", "curtain-fade"]),
});

export const carouselAngleInputSchema = z.object({
  id: z.string().uuid().optional(),
  angleKey: z.string().min(1).max(32),
  angleOrder: z.number().int().min(1).max(50),
  imagePath: z.string().min(1),
});

export const carouselItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  catalogNumber: z.string().trim().min(2).max(64).nullable().optional(),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  displayOrder: z.number().int().min(1).max(9999),
  isActive: z.boolean(),
  coverImagePath: z.string().min(1),
  color: z.string().max(60).nullable().optional(),
  dimensions: z.string().max(100).nullable().optional(),
  weight: z.string().max(30).nullable().optional(),
  sizes: z.array(z.string().max(30)).max(10).nullable().optional(),
  availableColors: z.array(z.string().max(40)).max(20).nullable().optional(),
  angles: z.array(carouselAngleInputSchema).min(1).max(20),
});

export const adminCarouselPayloadSchema = z.object({
  settings: carouselSettingsSchema,
  items: z.array(carouselItemInputSchema).min(1).max(80),
});
