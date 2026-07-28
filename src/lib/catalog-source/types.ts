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

// One colour of a product, discovered by enumerating the sibling product pages
// that share the same 5-char model token (every colour is its own MD product).
export interface SourceColorVariant {
  colorWord: string | null;   // English colour word parsed from the title (e.g. "steel")
  colorCode: string | null;   // global MD colour code — middle catalog segment (e.g. "465")
  title: string;
  catalogNumber: string | null;
  sourceUrl: string;
  handle: string;
  coverImageUrl: string;      // representative (first) image on that colour's product page
  imageUrls: string[];        // full gallery for this colour — its rotation angles
}

export interface CatalogSourceProvider {
  fetchByCatalogNumber(catalogNumber: string): Promise<SourceProduct>;
}
