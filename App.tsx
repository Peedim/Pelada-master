import React, { useState, useEffect } from 'react';
import PlayerDashboard from './components/PlayerDashboard';
import PlayerForm from './components/PlayerForm';
import TeamSorter from './components/TeamSorter';
import DraftList from './components/DraftList';
import DraftEditor from './components/DraftEditor';
import ActiveMatchDashboard from './components/ActiveMatchDashboard';
import MatchHistory from './components/MatchHistory';
import DataExport from './components/DataExport';
import FooterNav from './components/FooterNav';
import Home from './components/Home';
import Login from './components/Login';
import Career from './components/Career';
import Rankings from './components/Rankings'; // <--- IMPORTADO
import { Player, PlayerFormData, Match, MatchStatus } from './types';
import { playerService } from './services/playerService';
import { matchService } from './services/matchService';
import { supabase } from './services/supabaseClient';
import { LayoutDashboard, Shuffle, FolderOpen, History, Bell, LogOut } from 'lucide-react';

type AdminView = 'dashboard' | 'create' | 'edit' | 'sorter' | 'drafts' | 'draft-editor' | 'active-match' | 'history';

// TIPO ATUALIZADO
type MainTab = 'home' | 'career' | 'rankings' | 'admin'; 

const App: React.FC = () => {
  const [mainTab, setMainTab] = useState<MainTab>('home');
  const [adminView, setAdminView] = useState<AdminView>('dashboard');
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | undefined>(undefined);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [previousAdminView, setPreviousAdminView] = useState<AdminView>('drafts');
  const [session, setSession] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadInitialData();
    } else {
      setLoading(false);
    }
  }, [session]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [allPlayers, allMatches] = await Promise.all([
        playerService.getAll(),
        matchService.getAll()
      ]);
      setPlayers(allPlayers);
      setMatches(allMatches);

      if (session?.user?.email) {
        const userEmail = session.user.email.toLowerCase();
        const foundPlayer = allPlayers.find(p => p.email.toLowerCase() === userEmail);
        if (foundPlayer) setCurrentUserId(foundPlayer.id);
      }
    } catch (error) { console.error("Failed to load initial data", error); } finally { setLoading(false); }
  };

  const refreshData = async () => {
    try {
      const [allPlayers, allMatches] = await Promise.all([playerService.getAll(), matchService.getAll()]);
      setPlayers(allPlayers);
      setMatches(allMatches);
    } catch (error) { console.error("Error refreshing data:", error); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCurrentUserId(null);
    setMainTab('home');
  };

  if (!session) return <Login onLoginSuccess={() => {}} />;
  if (loading) return <div className="flex flex-col items-center justify-center h-screen bg-slate-900 space-y-4"><div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div><p className="text-slate-400 animate-pulse">Carregando perfil...</p></div>;
  if (!currentUserId && session) return <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-6 text-center"><div className="bg-slate-800 p-8 rounded-xl border border-slate-700 max-w-md"><h2 className="text-xl font-bold text-white mb-2">Perfil não encontrado</h2><p className="text-slate-400 mb-6">Você está logado como <span className="text-green-400">{session.user.email}</span>, mas não existe um jogador cadastrado com este e-mail no sistema.</p><div className="flex flex-col gap-3"><button onClick={handleLogout} className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg">Sair / Trocar Conta</button><p className="text-xs text-slate-500 mt-2">Peça para o administrador cadastrar este e-mail.</p></div></div></div>;

  const currentUser = players.find(p => p.id === currentUserId) || null;
  const isAdmin = currentUser?.is_admin || false;

  const handleAddPlayerClick = () => { setSelectedPlayer(undefined); setAdminView('create'); };
  const handleEditPlayerClick = (player: Player) => { setSelectedPlayer(player); setAdminView('edit'); };
  const handleFormSubmit = async (data: PlayerFormData) => { setActionLoading(true); try { if (adminView === 'edit' && selectedPlayer) await playerService.update(selectedPlayer.id, data); else await playerService.create(data); await refreshData(); setAdminView('dashboard'); } catch (error) { console.error(error); alert("Erro ao salvar."); } finally { setActionLoading(false); } };
  const handleCancel = () => { setAdminView('dashboard'); setSelectedPlayer(undefined); };
  const handleDraftSaved = () => { refreshData(); setAdminView('drafts'); };
  const handleSelectMatch = (match: Match) => { if (match.status === MatchStatus.DRAFT) { setSelectedDraftId(match.id); setAdminView('draft-editor'); } else { setActiveMatchId(match.id); setPreviousAdminView('drafts'); setAdminView('active-match'); } };
  const handleSelectHistoryMatch = (matchId: string) => { setActiveMatchId(matchId); setPreviousAdminView('history'); setAdminView('active-match'); };
  const handlePublishMatch = async (matchId: string) => { setActionLoading(true); try { await matchService.publishMatch(matchId); await refreshData(); setActiveMatchId(matchId); setPreviousAdminView('drafts'); setAdminView('active-match'); } catch (error: any) { alert(error.message); } finally { setActionLoading(false); } };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-green-500 selection:text-white">
      <div className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {mainTab === 'home' ? (
             <div className="flex items-center gap-4"><div className="grid grid-cols-2 gap-1"><div className="w-2 h-2 rounded-full bg-white/80"></div><div className="w-2 h-2 rounded-full bg-white/80"></div><div className="w-2 h-2 rounded-full bg-white/80"></div><div className="w-2 h-2 rounded-full bg-white/80"></div></div></div>
          ) : (
             <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAdminView('dashboard')}><div className="h-8 w-8 bg-cyan-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/30">P</div><span className="font-bold text-xl tracking-tight text-white hidden sm:block">Pelada Manager</span></div>
          )}
          
          <div className="absolute left-1/2 transform -translate-x-1/2 font-bold text-white uppercase tracking-wider hidden xs:block">{mainTab === 'home' ? 'PELADA MANAGER' : ''}</div>

          <div className="flex items-center gap-2">
            {mainTab === 'admin' && (
              <nav className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 overflow-x-auto mr-2 custom-scrollbar">
                <button onClick={() => setAdminView('dashboard')} className={`p-1.5 rounded-md transition-all ${['dashboard', 'create', 'edit'].includes(adminView) ? 'bg-slate-700 text-white' : 'text-slate-400'}`} title="Jogadores"><LayoutDashboard size={20} /></button>
                <button onClick={() => setAdminView('sorter')} className={`p-1.5 rounded-md transition-all ${adminView === 'sorter' ? 'bg-slate-700 text-white' : 'text-slate-400'}`} title="Sorteador"><Shuffle size={20} /></button>
                <button onClick={() => setAdminView('drafts')} className={`p-1.5 rounded-md transition-all ${['drafts', 'draft-editor', 'active-match'].includes(adminView) ? 'bg-slate-700 text-white' : 'text-slate-400'}`} title="Eventos"><FolderOpen size={20} /></button>
                <button onClick={() => setAdminView('history')} className={`p-1.5 rounded-md transition-all ${adminView === 'history' ? 'bg-slate-700 text-white' : 'text-slate-400'}`} title="Histórico"><History size={20} /></button>
              </nav>
            )}
            {mainTab === 'admin' && <DataExport />}
            {mainTab === 'home' && (<button className="relative p-2 text-slate-400 hover:text-white"><Bell size={24} /><span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span></button>)}
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-full transition-colors" title="Sair"><LogOut size={20} /></button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-4">
        {mainTab === 'home' && currentUser && <Home player={currentUser} matches={matches} />}
        {mainTab === 'career' && currentUser && <Career currentUser={currentUser} />}
        
        {/* RENDERIZAÇÃO DA TELA DE RANKINGS */}
        {mainTab === 'rankings' && <Rankings players={players} />}
        
        {mainTab === 'home' && !currentUser && <div className="flex flex-col items-center justify-center pt-20 text-slate-500"><p>Usuário não identificado.</p></div>}
        {mainTab === 'admin' && (
          <div className="px-4 sm:px-6 lg:px-8 pb-20">
            {adminView === 'dashboard' && <PlayerDashboard players={players} onAddPlayer={handleAddPlayerClick} onEditPlayer={handleEditPlayerClick} />}
            {(adminView === 'create' || adminView === 'edit') && <PlayerForm initialData={selectedPlayer} onSubmit={handleFormSubmit} onCancel={handleCancel} isLoading={actionLoading} />}
            {adminView === 'sorter' && <TeamSorter players={players} onDraftSaved={handleDraftSaved} />}
            {adminView === 'drafts' && <DraftList onSelectMatch={handleSelectMatch} />}
            {adminView === 'draft-editor' && selectedDraftId && <DraftEditor matchId={selectedDraftId} onBack={() => setAdminView('drafts')} onPublish={handlePublishMatch} isLoading={actionLoading} />}
            {adminView === 'active-match' && activeMatchId && <ActiveMatchDashboard matchId={activeMatchId} onBack={() => setAdminView(previousAdminView)} onMatchUpdate={refreshData} />}
            {adminView === 'history' && <MatchHistory onSelectMatch={handleSelectHistoryMatch} />}
          </div>
        )}
      </main>
      
      <FooterNav currentTab={mainTab} onTabChange={(tab) => setMainTab(tab as MainTab)} isAdmin={isAdmin} />
    </div>
  );
};

export default App;