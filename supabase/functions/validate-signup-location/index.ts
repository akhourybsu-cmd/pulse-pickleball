import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LocationValidationRequest {
  latitude: number
  longitude: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { latitude, longitude }: LocationValidationRequest = await req.json()

    // Validate input
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          error: 'Invalid coordinates provided' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Validate coordinates are within reasonable bounds
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          error: 'Coordinates out of valid range' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Call OpenStreetMap Nominatim API for reverse geocoding
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'PULSE-Pickleball-App/1.0'
      }
    })

    if (!response.ok) {
      console.error('Nominatim API error:', response.status)
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          error: 'Location verification service unavailable' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 503,
        },
      )
    }

    const data = await response.json()
    const state = data.address?.state

    console.log('Location validation:', { 
      latitude, 
      longitude, 
      state,
      country: data.address?.country 
    })

    // Check if location is in Massachusetts or Rhode Island
    const allowed = state === 'Massachusetts' || state === 'Rhode Island'

    return new Response(
      JSON.stringify({ 
        allowed,
        state: state || 'Unknown',
        message: allowed 
          ? 'Location verified' 
          : 'Service is currently only available in Massachusetts and Rhode Island'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error validating location:', error)
    return new Response(
      JSON.stringify({ 
        allowed: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
