// Verified-city autocomplete proxy for the Record Match wizard.
// Uses Google Maps Platform Places API (New) via the Lovable connector gateway,
// restricted to city / town level results so the stored location is always
// canonical (no typos, no inconsistent spellings).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_maps';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY_1') ?? Deno.env.get('GOOGLE_MAPS_API_KEY');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Restrict to city-like primary types so we never return a random business or
// street address — only municipal-level places.
const CITY_TYPES = ['locality', 'administrative_area_level_3', 'postal_town'];

interface SearchBody {
  action: 'search';
  query: string;
  sessionToken: string;
}
interface DetailsBody {
  action: 'details';
  placeId: string;
  sessionToken: string;
}
type Body = SearchBody | DetailsBody;

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return bad(405, 'Method not allowed');

  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
    return bad(500, 'Google Maps connector is not configured');
  }

  // Require an authenticated caller so we don't burn the connector key on
  // anonymous traffic.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return bad(401, 'Not authenticated');

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad(400, 'Invalid JSON');
  }

  if (body.action === 'search') {
    const query = (body.query ?? '').trim();
    const sessionToken = (body.sessionToken ?? '').trim();
    if (query.length < 2 || query.length > 100) return bad(400, 'Query too short or too long');
    if (!sessionToken) return bad(400, 'Missing sessionToken');

    const resp = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: query,
        sessionToken,
        includedPrimaryTypes: CITY_TYPES,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('Autocomplete failed', resp.status, text);
      return bad(502, 'Place lookup failed');
    }
    const data = await resp.json();
    const suggestions = (data.suggestions ?? []).map((s: any) => {
      const p = s.placePrediction;
      if (!p) return null;
      return {
        placeId: p.placeId,
        label: p.text?.text ?? '',
        primary: p.structuredFormat?.mainText?.text ?? '',
        secondary: p.structuredFormat?.secondaryText?.text ?? '',
      };
    }).filter(Boolean);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (body.action === 'details') {
    const placeId = (body.placeId ?? '').trim();
    const sessionToken = (body.sessionToken ?? '').trim();
    if (!placeId) return bad(400, 'Missing placeId');

    const url = new URL(`${GATEWAY}/places/v1/places/${encodeURIComponent(placeId)}`);
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken);

    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,types',
      },
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('Place details failed', resp.status, text);
      return bad(502, 'Place details failed');
    }
    const place = await resp.json();

    const comps: Array<{ longText: string; shortText: string; types: string[] }> =
      place.addressComponents ?? [];
    const findComp = (...types: string[]) =>
      comps.find((c) => c.types?.some((t) => types.includes(t)));

    const cityComp = findComp('locality', 'postal_town', 'administrative_area_level_3');
    const regionComp = findComp('administrative_area_level_1');
    const countryComp = findComp('country');

    const city = cityComp?.longText ?? place.displayName?.text ?? '';
    const region = regionComp?.shortText ?? '';
    const country = countryComp?.shortText ?? '';
    // For US, "Brooklyn, NY". For non-US, "Toronto, ON, CA" or "Paris, FR".
    const isUS = country === 'US';
    const name = isUS
      ? [city, region].filter(Boolean).join(', ')
      : [city, region, country].filter(Boolean).join(', ');

    return new Response(JSON.stringify({
      placeId: place.id,
      name,
      city,
      state: region,
      country,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return bad(400, 'Unknown action');
});
