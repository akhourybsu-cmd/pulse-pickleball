import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import RallyHausDemoPage from '../../../src/components/venue/RallyHausDemoPage';
import { RALLY_HAUS_GROUP_ID, RALLY_HAUS_VENUE_ID } from '../../../src/lib/venues/rallyHausDemo';
import '../../../src/index.css';
const group = {
  id: RALLY_HAUS_GROUP_ID, name: 'Rally Haus Sports', icon_url: null,
  venue: { id: RALLY_HAUS_VENUE_ID, name: 'Rally Haus Sports', slug: 'rally-haus-sports-d99d7de3',
    logo_url: 'https://rqfqwavhtfwwtmfjnxkx.supabase.co/storage/v1/object/public/venue-logos/d99d7de3-2431-4ee2-a826-04cc293da1cd/venue-logo-9570f886-b58c-4b87-9e4d-ae3b775c4437.webp',
    cover_image_url: null, logo_image_fit: 'cover' as const, cover_image_fit: null, logo_shape: 'circle' as const, cover_focal_point: null,
    primary_color: '#0051a6', secondary_color: '#0c7829', tagline: null, welcome_headline: 'Welcome to Rally Haus!', welcome_message: null,
    city: 'Attleboro', state: 'MA', timezone: 'America/New_York', website_url: 'https://rallyhaussports.com/',
    hours_of_operation: { days: Object.fromEntries(Array.from({length:7}, (_, i) => [i, {open:'06:00',close:'22:00'}])) },
  },
};
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/venues/rally-haus-sports-d99d7de3']}><main className="mx-auto max-w-6xl"><RallyHausDemoPage group={group} /></main></MemoryRouter>);
