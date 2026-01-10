import { useMemo } from 'react';
import { VenueSettings } from './useVenueSettings';

export interface PublishReadinessItem {
  id: string;
  label: string;
  isComplete: boolean;
  isRequired: boolean;
  link?: string;
}

export interface PublishReadinessResult {
  isReady: boolean;
  requiredItems: PublishReadinessItem[];
  recommendedItems: PublishReadinessItem[];
  completionPercentage: number;
  missingRequired: string[];
}

export function usePublishReadiness(venue: VenueSettings | null): PublishReadinessResult {
  return useMemo(() => {
    if (!venue) {
      return {
        isReady: false,
        requiredItems: [],
        recommendedItems: [],
        completionPercentage: 0,
        missingRequired: ['Venue data not loaded']
      };
    }

    const requiredItems: PublishReadinessItem[] = [
      {
        id: 'name',
        label: 'Venue name',
        isComplete: Boolean(venue.name?.trim()),
        isRequired: true,
        link: '/venue/profile'
      },
      {
        id: 'location',
        label: 'City & State',
        isComplete: Boolean(venue.city?.trim() && venue.state?.trim()),
        isRequired: true,
        link: '/venue/profile'
      },
      {
        id: 'contact',
        label: 'At least one contact method',
        isComplete: Boolean(
          venue.website || 
          venue.phone || 
          venue.email || 
          venue.address
        ),
        isRequired: true,
        link: '/venue/profile'
      }
    ];

    const recommendedItems: PublishReadinessItem[] = [
      {
        id: 'cover_image',
        label: 'Cover image',
        isComplete: Boolean(venue.banner_url),
        isRequired: false,
        link: '/venue/branding'
      },
      {
        id: 'description',
        label: 'Description',
        isComplete: Boolean(venue.description?.trim()),
        isRequired: false,
        link: '/venue/profile'
      },
      {
        id: 'logo',
        label: 'Logo',
        isComplete: Boolean(venue.logo_url),
        isRequired: false,
        link: '/venue/branding'
      },
      {
        id: 'tagline',
        label: 'Tagline',
        isComplete: Boolean(venue.tagline?.trim()),
        isRequired: false,
        link: '/venue/profile'
      }
    ];

    const missingRequired = requiredItems
      .filter(item => !item.isComplete)
      .map(item => item.label);

    const isReady = missingRequired.length === 0;

    const allItems = [...requiredItems, ...recommendedItems];
    const completedCount = allItems.filter(item => item.isComplete).length;
    const completionPercentage = Math.round((completedCount / allItems.length) * 100);

    return {
      isReady,
      requiredItems,
      recommendedItems,
      completionPercentage,
      missingRequired
    };
  }, [venue]);
}
