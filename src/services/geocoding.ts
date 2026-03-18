import { appConfig } from '@/config';

export type Coordinates = { latitude: number; longitude: number };

type GeocodeResponse = {
  status: string;
  results?: {
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  }[];
  error_message?: string;
};

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const buildUrl = (query: string) => `${GOOGLE_GEOCODE_URL}?${query}&key=${appConfig.mapsApiKey}`;

const requestGeocode = async (query: string): Promise<GeocodeResponse> => {
  const response = await fetch(buildUrl(query));
  if (!response.ok) {
    throw new Error(`Geocoding request failed with status ${response.status}`);
  }
  return (await response.json()) as GeocodeResponse;
};

export async function geocodeAddress(address: string): Promise<Coordinates> {
  if (!appConfig.mapsApiKey) {
    // fallback mock coordinates
    return { latitude: 39.9208, longitude: 32.8541 };
  }

  try {
    const data = await requestGeocode(`address=${encodeURIComponent(address)}`);
    const location = data.results?.[0]?.geometry?.location;
    if (!location || data.status !== 'OK') {
      throw new Error(data.error_message ?? `Geocoding failed with status ${data.status}`);
    }
    return { latitude: location.lat, longitude: location.lng };
  } catch {
    return { latitude: 39.9208, longitude: 32.8541 };
  }
}

export async function reverseGeocode(coord: Coordinates): Promise<string> {
  if (!appConfig.mapsApiKey) {
    return 'Unknown address (add MAPS_API_KEY)';
  }

  try {
    const data = await requestGeocode(`latlng=${coord.latitude},${coord.longitude}`);
    const label = data.results?.[0]?.formatted_address;
    if (!label || data.status !== 'OK') {
      throw new Error(data.error_message ?? `Geocoding failed with status ${data.status}`);
    }
    return label;
  } catch {
    return 'Unknown address';
  }
}
