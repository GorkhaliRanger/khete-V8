export const siteContentSelect = "key,value_en,value_ne,updated_at";

export type SiteContentRow = {
  key: string;
  value_en: string;
  value_ne: string | null;
  updated_at: string;
};

export const STORY_MARQUEE_KEY = "story_marquee";

export const STORY_MARQUEE_DEFAULT_EN = "From our fields to your family — trade that begins and ends with the farmer.";

export const STORY_MARQUEE_DEFAULT_NE = "हाम्रो खेतबाट तपाईंको परिवारसम्म — जसको सुरुवात किसानबाटै हुन्छ, अन्त्य पनि किसानमै।";

export const HOME_MARQUEE_KEY = "home_marquee";

export const HOME_MARQUEE_DEFAULT_EN = "From fields to futures — fresh produce, farm essentials and trusted expertise.";

export const HOME_MARQUEE_DEFAULT_NE = "खेतदेखि भविष्यसम्म — ताजा उत्पादन, कृषि आवश्यक सामग्री र भरपर्दो विशेषज्ञता।";

export function siteContentError(caught: unknown) {
  return caught instanceof Error ? caught.message : "Something went wrong while loading site content.";
}
