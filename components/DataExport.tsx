
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { playerService } from '../services/playerService';
import { matchService } from '../services/matchService';
import { Download, Database, Loader2 } from 'lucide-react';

const DataExport: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // 1. Fetch Data
      const players = await playerService.getAll();
      const matches = await matchService.getAll();

      // 2. Prepare Worksheet: Jogadores
      const playersData = players.map(p => ({
        ID: p.id,
        Nome: p.name,
        Email: p.email,
        Posicao: p.position,
        Estilo: p.playStyle,
        OVR: p.initial_ovr,
        Admin: p.is_admin ? 'Sim' : 'Não',
        Criado_Em: new Date(p.created_at || '').toLocaleDateString(),
        // Attributes flattened
        Ritmo: p.attributes.pace,
        Chute: p.attributes.shooting,
        Passe: p.attributes.passing,
        Drible: p.attributes.dribbling,
        Defesa: p.attributes.defending,
        Fisico: p.attributes.physical
      }));

      // 3. Prepare Worksheet: Eventos (Matches)
      const matchesData = matches.map(m => ({
        ID_Evento: m.id,
        Data: new Date(m.date).toLocaleDateString(),
        Local: m.location,
        Tipo: m.type,
        Status: m.status,
        Qtd_Times: m.teams.length,
        Total_Gols: m.goals?.length || 0
      }));

      // 4. Prepare Worksheet: Elencos (Squads)
      const squadData: any[] = [];
      matches.forEach(m => {
        m.teams.forEach(t => {
          t.players.forEach(p => {
            squadData.push({
              ID_Evento: m.id,
              Data_Evento: new Date(m.date).toLocaleDateString(),
              Time: t.name,
              Jogador: p.name,
              Posicao: p.position,
              OVR_Na_Epoca: p.initial_ovr
            });
          });
        });
      });

      // 5. Prepare Worksheet: Jogos (Games/Fixtures)
      const gamesData: any[] = [];
      matches.forEach(m => {
        if (!m.games) return;
        m.games.forEach(g => {
          const homeName = m.teams.find(t => t.id === g.homeTeamId)?.name || 'A Definir';
          const awayName = m.teams.find(t => t.id === g.awayTeamId)?.name || 'A Definir';
          
          gamesData.push({
            ID_Jogo: g.id,
            ID_Evento: m.id,
            Fase: g.phase,
            Sequencia: g.sequence,
            Time_Casa: homeName,
            Placar_Casa: g.homeScore,
            Placar_Fora: g.awayScore,
            Time_Fora: awayName,
            Status: g.status
          });
        });
      });

      // 6. Prepare Worksheet: Gols (Stats)
      const goalsData: any[] = [];
      matches.forEach(m => {
        if (!m.goals) return;
        m.goals.forEach(goal => {
          const game = m.games.find(g => g.id === goal.gameId);
          const homeName = m.teams.find(t => t.id === game?.homeTeamId)?.name;
          const awayName = m.teams.find(t => t.id === game?.awayTeamId)?.name;
          const matchTitle = `${homeName} vs ${awayName}`;
          
          const teamName = m.teams.find(t => t.id === goal.teamId)?.name;
          const scorerName = m.teams.flatMap(t => t.players).find(p => p.id === goal.scorerId)?.name;
          const assistName = goal.assistId ? m.teams.flatMap(t => t.players).find(p => p.id === goal.assistId)?.name : 'Sem Assistência';

          goalsData.push({
            ID_Evento: m.id,
            Partida: matchTitle,
            Time_Marcador: teamName,
            Autor_Gol: scorerName,
            Autor_Assistencia: assistName,
            Minuto_Simulado: goal.minute
          });
        });
      });

      // 7. Create Workbook
      const wb = XLSX.utils.book_new();
      
      const wsPlayers = XLSX.utils.json_to_sheet(playersData);
      XLSX.utils.book_append_sheet(wb, wsPlayers, "Jogadores");

      const wsMatches = XLSX.utils.json_to_sheet(matchesData);
      XLSX.utils.book_append_sheet(wb, wsMatches, "Eventos");

      const wsSquads = XLSX.utils.json_to_sheet(squadData);
      XLSX.utils.book_append_sheet(wb, wsSquads, "Elencos_Historico");

      const wsGames = XLSX.utils.json_to_sheet(gamesData);
      XLSX.utils.book_append_sheet(wb, wsGames, "Tabela_Jogos");
      
      const wsGoals = XLSX.utils.json_to_sheet(goalsData);
      XLSX.utils.book_append_sheet(wb, wsGoals, "Gols_Stats");

      // 8. Write File
      XLSX.writeFile(wb, "PeladaManager_BancoDeDados.xlsx");

    } catch (error) {
      console.error("Export failed", error);
      alert("Erro ao exportar dados.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button 
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-green-400 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
      title="Baixar Banco de Dados em Excel"
    >
      {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
      <span className="hidden sm:inline">Exportar DB</span>
    </button>
  );
};

export default DataExport;
