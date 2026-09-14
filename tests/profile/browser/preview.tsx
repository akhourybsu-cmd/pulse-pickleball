import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import PlayerProfile from '../../../src/pages/player/PlayerProfile';
import '../../../src/index.css';

// Larger text can be tested without modifying browser/account preferences.
if (new URLSearchParams(window.location.search).has('large-text')) document.documentElement.style.fontSize = '20px';
createRoot(document.getElementById('root')!).render(<MemoryRouter><PlayerProfile /></MemoryRouter>);
