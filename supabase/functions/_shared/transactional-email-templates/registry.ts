/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

// TemplateEntry: shape every transactional email template exports.
// `component` is the React Email component, `subject` is either a string or a
// function of templateData. `previewData` is used by the dashboard preview.
export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string
}

import { template as registrationConfirmation } from './registration-confirmation.tsx'
import { template as registrationApproved } from './registration-approved.tsx'
import { template as registrationWaitlisted } from './registration-waitlisted.tsx'
import { template as roundRobinConfirmation } from './round-robin-confirmation.tsx'
import { template as teamAssignment } from './team-assignment.tsx'
import { template as courtAssignment } from './court-assignment.tsx'
import { template as calendarEventConfirmation } from './calendar-event-confirmation.tsx'
import { template as venueAnnouncement } from './venue-announcement.tsx'
import { template as tournamentNotification } from './tournament-notification.tsx'
import { template as tournamentReminder } from './tournament-reminder.tsx'
import { template as eventReminder } from './event-reminder.tsx'
import { template as groupEventReminder } from './group-event-reminder.tsx'
import { template as contestedMatchAlert } from './contested-match-alert.tsx'
import { template as venueInquiryAlert } from './venue-inquiry-alert.tsx'
import { template as matchVerificationRequest } from './match-verification-request.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'registration-confirmation': registrationConfirmation,
  'registration-approved': registrationApproved,
  'registration-waitlisted': registrationWaitlisted,
  'round-robin-confirmation': roundRobinConfirmation,
  'team-assignment': teamAssignment,
  'court-assignment': courtAssignment,
  'calendar-event-confirmation': calendarEventConfirmation,
  'venue-announcement': venueAnnouncement,
  'tournament-notification': tournamentNotification,
  'tournament-reminder': tournamentReminder,
  'event-reminder': eventReminder,
  'group-event-reminder': groupEventReminder,
  'contested-match-alert': contestedMatchAlert,
  'venue-inquiry-alert': venueInquiryAlert,
  'match-verification-request': matchVerificationRequest,
}
