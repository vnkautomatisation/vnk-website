"use client";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: { types?: string[]; fields?: string[]; componentRestrictions?: { country?: string | string[] } }
          ) => GoogleAutocomplete;
        };
      };
    };
  }
}

export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type GooglePlaceResult = {
  address_components?: GoogleAddressComponent[];
  formatted_address?: string;
};

interface GoogleAutocomplete {
  addListener(event: string, cb: () => void): { remove: () => void };
  getPlace(): GooglePlaceResult;
}

let scriptLoadingPromise: Promise<void> | null = null;

function loadScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps?.places) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadingPromise = null;
      reject(new Error("Google Maps script failed to load"));
    };
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

export function useGooglePlaces(): { available: boolean; loaded: boolean; failed: boolean } {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    loadScript(apiKey)
      .then(() => { if (!cancelled) setLoaded(true); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [apiKey]);

  return { available: !!apiKey, loaded, failed };
}

/**
 * Parse Google Places address_components vers les champs de notre formulaire.
 * Retourne un mapping vers {street, city, province, postal, country (ISO 3166-1 alpha-2)}.
 */
export function parseAddressComponents(components: GoogleAddressComponent[] = []): {
  street: string;
  city: string;
  province: string;
  postal: string;
  country: string;
} {
  let streetNumber = "";
  let route = "";
  let city = "";
  let province = "";
  let postal = "";
  let country = "";

  for (const c of components) {
    if (c.types.includes("street_number")) streetNumber = c.long_name;
    else if (c.types.includes("route")) route = c.long_name;
    else if (c.types.includes("locality") || c.types.includes("postal_town") || c.types.includes("sublocality_level_1")) {
      if (!city) city = c.long_name;
    }
    else if (c.types.includes("administrative_area_level_1")) province = c.short_name;
    else if (c.types.includes("postal_code")) postal = c.long_name;
    else if (c.types.includes("country")) country = c.short_name.toUpperCase();
  }

  // Google retourne UK pour Royaume-Uni alors que ISO veut GB
  if (country === "UK") country = "GB";

  return {
    street: `${streetNumber} ${route}`.trim(),
    city,
    province,
    postal,
    country,
  };
}
