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
}

export interface CatalogSourceProvider {
  fetchByCatalogNumber(catalogNumber: string): Promise<SourceProduct>;
}
