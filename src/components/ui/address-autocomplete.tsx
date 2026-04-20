'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Google Maps types - simplified for our use case
interface GoogleMapsAutocomplete {
    addListener: (event: string, callback: () => void) => void;
    getPlace: () => GoogleMapsPlaceResult;
}

interface GoogleMapsPlaceResult {
    formatted_address?: string;
    address_components?: GoogleMapsAddressComponent[];
}

interface GoogleMapsAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
}

interface GoogleMapsAutocompleteService {
    getPlacePredictions: (
        request: { input: string; componentRestrictions?: { country: string }; types?: string[] },
        callback: (predictions: GoogleMapsPrediction[] | null, status: string) => void
    ) => void;
}

interface GoogleMapsPrediction {
    place_id: string;
    description: string;
}

interface GoogleMapsPlacesService {
    getDetails: (
        request: { placeId: string; fields: string[] },
        callback: (place: GoogleMapsPlaceResult | null, status: string) => void
    ) => void;
}

// Declare Google Maps on window
declare global {
    interface Window {
        google?: {
            maps: {
                places: {
                    Autocomplete: new (
                        input: HTMLInputElement,
                        options?: {
                            types?: string[];
                            componentRestrictions?: { country: string };
                            fields?: string[];
                        }
                    ) => GoogleMapsAutocomplete;
                    AutocompleteService: new () => GoogleMapsAutocompleteService;
                    PlacesService: new (attrContainer: HTMLElement) => GoogleMapsPlacesService;
                };
            };
        };
    }
}

export interface AddressComponents {
    address: string;    // Street address (e.g., "123 Main Street")
    city: string;       // Suburb/locality
    state: string;      // State code (e.g., "NSW", "VIC")
    postcode: string;   // Postal code
    fullAddress: string; // Full formatted address
}

interface AddressAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onAddressSelect: (components: AddressComponents) => void;
    apiKey?: string;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

// Track script loading state globally
let isScriptLoaded = false;
let isScriptLoading = false;
const scriptLoadCallbacks: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
let runtimeApiKeyPromise: Promise<string | null> | null = null;

async function getRuntimeApiKey(): Promise<string | null> {
    if (runtimeApiKeyPromise) {
        return runtimeApiKeyPromise;
    }

    runtimeApiKeyPromise = fetch('/api/public/google-maps-key', { cache: 'no-store' })
        .then(async (response) => {
            if (!response.ok) {
                return null;
            }

            const data = (await response.json()) as { apiKey?: string };
            const key = data.apiKey?.trim();
            return key || null;
        })
        .catch(() => null);

    return runtimeApiKeyPromise;
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!apiKey) {
            reject(new Error('Google Maps API key is missing'));
            return;
        }

        if (isScriptLoaded && window.google?.maps?.places) {
            resolve();
            return;
        }

        if (isScriptLoading) {
            scriptLoadCallbacks.push({ resolve, reject });
            return;
        }

        isScriptLoading = true;

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            if (!window.google?.maps?.places) {
                const error = new Error('Google Maps Places library did not load');
                isScriptLoading = false;
                reject(error);
                scriptLoadCallbacks.forEach((cb) => cb.reject(error));
                scriptLoadCallbacks.length = 0;
                return;
            }

            isScriptLoaded = true;
            isScriptLoading = false;
            resolve();
            scriptLoadCallbacks.forEach((cb) => cb.resolve());
            scriptLoadCallbacks.length = 0;
        };

        script.onerror = () => {
            isScriptLoading = false;
            const error = new Error('Failed to load Google Maps script');
            console.error('[AddressAutocomplete] Failed to load Google Maps script');
            reject(error);
            scriptLoadCallbacks.forEach((cb) => cb.reject(error));
            scriptLoadCallbacks.length = 0;
        };

        document.head.appendChild(script);
    });
}

function parseAddressComponents(place: GoogleMapsPlaceResult): AddressComponents {
    const components: AddressComponents = {
        address: '',
        city: '',
        state: '',
        postcode: '',
        fullAddress: place.formatted_address || '',
    };

    if (!place.address_components) {
        return components;
    }

    let streetNumber = '';
    let route = '';

    for (const component of place.address_components) {
        const types = component.types;

        if (types.includes('street_number')) {
            streetNumber = component.long_name;
        } else if (types.includes('route')) {
            route = component.long_name;
        } else if (types.includes('locality') || types.includes('sublocality_level_1')) {
            components.city = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
            components.state = component.short_name; // e.g., "NSW", "VIC"
        } else if (types.includes('postal_code')) {
            components.postcode = component.long_name;
        }
    }

    // Combine street number and route
    if (streetNumber && route) {
        components.address = `${streetNumber} ${route}`;
    } else if (route) {
        components.address = route;
    } else if (streetNumber) {
        components.address = streetNumber;
    }

    return components;
}

export function AddressAutocomplete({
    value,
    onChange,
    onAddressSelect,
    apiKey,
    placeholder = 'Start typing your address...',
    className,
    disabled = false,
}: AddressAutocompleteProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<GoogleMapsAutocomplete | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [runtimeApiKey, setRuntimeApiKey] = useState<string | null>(null);
    const providedApiKey = apiKey?.trim() || '';
    const resolvedApiKey = providedApiKey || runtimeApiKey || '';

    const handlePlaceSelect = useCallback(() => {
        if (!autocompleteRef.current) return;

        const place = autocompleteRef.current.getPlace();
        if (!place || !place.address_components) {
            console.log('[AddressAutocomplete] No place selected or no address components');
            return;
        }

        const components = parseAddressComponents(place);
        console.log('[AddressAutocomplete] Address selected:', components);

        // Update the input value to the formatted address
        onChange(place.formatted_address || '');

        // Notify parent with parsed components
        onAddressSelect(components);
    }, [onChange, onAddressSelect]);

    useEffect(() => {
        if (providedApiKey || runtimeApiKey !== null) {
            return;
        }

        let mounted = true;

        getRuntimeApiKey().then((runtimeKey) => {
            if (!mounted) {
                return;
            }
            setRuntimeApiKey(runtimeKey);
        });

        return () => {
            mounted = false;
        };
    }, [providedApiKey, runtimeApiKey]);

    useEffect(() => {
        if (!resolvedApiKey) {
            console.error('[AddressAutocomplete] No API key provided');
            return;
        }

        let mounted = true;

        loadGoogleMapsScript(resolvedApiKey)
            .then(() => {
                if (mounted) {
                    setIsLoaded(true);
                }
            })
            .catch((error) => {
                if (mounted) {
                    setIsLoaded(false);
                }
                console.error('[AddressAutocomplete] Failed to load Google Maps:', error);
            });

        return () => {
            mounted = false;
        };
    }, [resolvedApiKey]);

    useEffect(() => {
        if (!isLoaded || !inputRef.current || !window.google?.maps?.places) return;
        if (autocompleteRef.current) return; // Already initialized

        try {
            const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
                types: ['address'],
                componentRestrictions: { country: 'au' }, // Australia only
                fields: ['address_components', 'formatted_address'],
            });

            autocomplete.addListener('place_changed', handlePlaceSelect);
            autocompleteRef.current = autocomplete as unknown as GoogleMapsAutocomplete;
            console.log('[AddressAutocomplete] Initialized successfully');
        } catch (error) {
            console.error('[AddressAutocomplete] Failed to initialize:', error);
        }

        return () => {
            // Cleanup is handled by Google Maps internally
        };
    }, [isLoaded, handlePlaceSelect]);

    return (
        <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(className)}
            disabled={disabled}
            autoComplete="off"
        />
    );
}

/**
 * Utility function to validate/autocomplete an extracted address
 * This can be used to clean up OCR-extracted addresses
 */
export async function validateAddress(
    rawAddress: string,
    apiKey: string
): Promise<AddressComponents | null> {
    return new Promise((resolve) => {
        loadGoogleMapsScript(apiKey)
            .then(() => {
                if (!window.google?.maps?.places) {
                    resolve(null);
                    return;
                }

                const service = new window.google.maps.places.AutocompleteService();

                service.getPlacePredictions(
                    {
                        input: rawAddress,
                        componentRestrictions: { country: 'au' },
                        types: ['address'],
                    },
                    (predictions, status) => {
                        if (status !== 'OK' || !predictions || predictions.length === 0) {
                            console.log('[AddressAutocomplete] No predictions for:', rawAddress);
                            resolve(null);
                            return;
                        }

                        // Get details for the first prediction
                        if (!window.google?.maps?.places) {
                            resolve(null);
                            return;
                        }
                        const placesService = new window.google.maps.places.PlacesService(
                            document.createElement('div')
                        );

                        placesService.getDetails(
                            {
                                placeId: predictions[0].place_id,
                                fields: ['address_components', 'formatted_address'],
                            },
                            (place, detailStatus) => {
                                if (detailStatus !== 'OK' || !place) {
                                    resolve(null);
                                    return;
                                }

                                const components = parseAddressComponents(place);
                                console.log('[AddressAutocomplete] Validated address:', components);
                                resolve(components);
                            }
                        );
                    }
                );
            })
            .catch(() => {
                resolve(null);
            });
    });
}

export default AddressAutocomplete;
