/**
 * Geocoding Service using Google Maps API
 */

export interface GeocodeResult {
    lat: number;
    lng: number;
    formattedAddress?: string;
}

/**
 * Geocode an address using its components
 */
export async function geocodeAddress(
    calle: string | null,
    numero: string | null,
    localidad: string | null
): Promise<GeocodeResult | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.warn("Geocoding failed: GOOGLE_MAPS_API_KEY is not set.");
        return null;
    }

    if (!calle || !numero) {
        // Fallback: If we have at least something in calle, try raw geocoding it
        if (calle) return geocodeRawAddress([calle, localidad].filter(Boolean).join(', '));
        return null;
    }

    try {
        // To help Google Maps, if localidad is missing, we append a default province context
        const queryAddress = [calle, numero, localidad || 'Buenos Aires'].filter(Boolean).join(', ');
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryAddress)}&key=${apiKey}&region=ar`;
        
        const res = await fetch(geoUrl);
        const data = await res.json();
        
        if (data.status === 'OK' && data.results?.length) {
            return {
                lat: data.results[0].geometry.location.lat,
                lng: data.results[0].geometry.location.lng,
                formattedAddress: data.results[0].formatted_address
            };
        }
        
        console.warn(`Geocoding status for "${queryAddress}": ${data.status}`);
        return null;
    } catch (error) {
        console.error("Geocoding exception:", error);
        return null;
    }
}

/**
 * Geocode a raw address string (backup method)
 */
export async function geocodeRawAddress(address: string): Promise<GeocodeResult | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || !address) return null;

    try {
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&region=ar`;
        const res = await fetch(geoUrl);
        const data = await res.json();

        if (data.status === 'OK' && data.results?.length) {
            return {
                lat: data.results[0].geometry.location.lat,
                lng: data.results[0].geometry.location.lng,
                formattedAddress: data.results[0].formatted_address
            };
        }
        return null;
    } catch (error) {
        console.error("Geocoding raw exception:", error);
        return null;
    }
}
