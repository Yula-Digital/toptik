export interface SourceColorImage {
  color: string;
  imageUrl: string;
}

export interface SourceProduct {
  catalogNumber: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  sourceUrl: string;
  color?: string | null;
  dimensions?: string | null;
  weight?: string | null;
  sizes?: string[];
  availableColors?: string[];
  /** One representative image per additional color, so the UI can preview other colors. */
  colorImages?: SourceColorImage[];
}

export interface CatalogSourceProvider {
  fetchByCatalogNumber(catalogNumber: string): Promise<SourceProduct>;
}
