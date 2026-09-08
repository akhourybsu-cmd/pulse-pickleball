import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,useNavigate} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {TooltipProvider} from '@/components/ui/tooltip';
import {Toaster} from 'sonner';
import AdminLeagueDetail from '@/pages/admin/AdminLeagueDetail';
import PlayerLeagueDetail from '@/pages/player/PlayerLeagueDetail';
import {QaAuth} from './stub';
import '@/index.css';

const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
export function Preview(){const [user,setUser]=useState('owner');const navigate=useNavigate();return <QaAuth user={user}>
  <div className="flex flex-wrap gap-2 bg-slate-900 p-3 text-white text-xs"><strong className="w-full">ISOLATED QA · fictional data, no live backend</strong>
    <button className="rounded border p-2" onClick={()=>{setUser('owner');navigate('/player/leagues/league/manage')}}>Organizer preview</button>
    <button className="rounded border p-2" onClick={()=>{setUser('player');navigate('/player/leagues/league')}}>Member preview</button>
  </div>
  <Routes><Route path="/player/leagues/:leagueId/manage" element={<AdminLeagueDetail/>}/><Route path="/player/leagues/:leagueId" element={<PlayerLeagueDetail/>}/></Routes>
  <Toaster/>
</QaAuth>}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><TooltipProvider><MemoryRouter initialEntries={['/player/leagues/league/manage?tab=seasons']}><Preview/></MemoryRouter></TooltipProvider></QueryClientProvider>);
