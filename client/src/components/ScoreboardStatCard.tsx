import { useState, useEffect } from 'react';
import type { Player, PlayerStats } from '@shared/schema';
import { 
  listenToPlayerStats, 
  createEmptyPlayerStats, 
  getTeamById, 
  listenToStatLogs,
  type StatLog
} from '@/lib/firebase';

interface ScoreboardStatCardProps {
  player: Player;
  playerId: string;
  matchId: string;
  teamId?: string;
  stats?: PlayerStats; // Optional stats passed from parent
  isLoading?: boolean; // Whether stats are being loaded
}

// Helper function to get emoji for stat type
const getStatEmoji = (statName: keyof PlayerStats): string => {
  const emojiMap: Record<keyof PlayerStats, string> = {
    aces: '🔥',
    serveErrors: '❌',
    spikes: '💥',
    spikeErrors: '❌',
    digs: '🛡️',
    blocks: '🧱',
    netTouches: '🔗',
    tips: '👆',
    dumps: '🧮',
    footFaults: '👣',
    reaches: '🙋',
    carries: '🤲'
  };
  return emojiMap[statName] || '📊';
};

// Helper function for stat category color
const getStatCategoryColor = (statName: keyof PlayerStats): string => {
  // Earned points - Green
  if (['aces', 'spikes', 'blocks', 'tips', 'dumps', 'digs'].includes(statName)) {
    return 'bg-green-500';
  }
  // Faults - Red (including reaches now)
  else {
    return 'bg-red-500';
  }
};

// Helper function to calculate stats from logs
const calculateStatsFromLogs = (logs: StatLog[], playerId: string): PlayerStats => {
  console.log(`[STAT_CALC] Calculating stats for player ${playerId} from ${logs.length} logs`);
  
  // Filter logs for this player
  const playerLogs = logs.filter(log => log.playerId === playerId);
  
  console.log(`[STAT_CALC] Found ${playerLogs.length} logs for this player`);
  
  // Initialize empty stats
  const stats = createEmptyPlayerStats();
  
  // Aggregate stats from logs
  playerLogs.forEach(log => {
    if (log.statName && log.value) {
      stats[log.statName] = (stats[log.statName] || 0) + log.value;
    }
  });
  
  console.log(`[STAT_CALC] Calculated stats:`, stats);
  return stats;
};

const ScoreboardStatCard = ({ player, playerId, matchId, teamId, stats: propStats, isLoading: externalLoading }: ScoreboardStatCardProps) => {
  const [localStats, setLocalStats] = useState<PlayerStats>(createEmptyPlayerStats());
  const [logsStats, setLogsStats] = useState<PlayerStats>(createEmptyPlayerStats());
  const [teamColor, setTeamColor] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(propStats ? false : true);
  const [logsLoading, setLogsLoading] = useState(true);
  
  // Use external loading state if provided, otherwise use internal loading state
  const isLoading = externalLoading !== undefined ? externalLoading : (internalLoading && logsLoading);
  
  // If the component receives stats as a prop, use those - otherwise use the best available stats
  // Priority: 1. propStats (parent provided), 2. logsStats (calculated from logs), 3. localStats (from Firebase stats path)
  const stats = propStats || logsStats || localStats;
  
  // Set up listener for stat logs to calculate stats directly
  useEffect(() => {
    if (!matchId) {
      console.log('[SCOREBOARD_STAT] Missing matchId for stat logs listener');
      setLogsLoading(false);
      return;
    }
    
    console.log(`[SCOREBOARD_STAT] Setting up stat logs listener for match ${matchId}`);
    setLogsLoading(true);
    
    const unsubscribe = listenToStatLogs(matchId, (logs) => {
      console.log(`[SCOREBOARD_STAT] Received ${logs.length} stat logs for match ${matchId}`);
      
      if (logs.length > 0) {
        // Calculate player stats from logs
        const calculatedStats = calculateStatsFromLogs(logs, playerId);
        setLogsStats(calculatedStats);
      }
      setLogsLoading(false);
    });
    
    return () => {
      console.log(`[SCOREBOARD_STAT] Removing stat logs listener for match ${matchId}`);
      unsubscribe();
    };
  }, [matchId, playerId]);
  
  // Only set up the listener if stats weren't provided as props (backup)
  useEffect(() => {
    // If stats are provided as props, we don't need to fetch them
    if (propStats) {
      setInternalLoading(false);
      return;
    }
    
    if (!matchId || !playerId) {
      console.log('[SCOREBOARD_STAT] Missing matchId or playerId:', { matchId, playerId });
      setInternalLoading(false);
      return;
    }
    
    setInternalLoading(true);
    console.log(`[SCOREBOARD_STAT] Setting up player stats listener for match ${matchId}, player ${playerId}`);
    
    const unsubscribe = listenToPlayerStats(matchId, playerId, (playerStats) => {
      console.log(`[SCOREBOARD_STAT] Received stats for ${playerId}:`, playerStats);
      setLocalStats(playerStats);
      setInternalLoading(false);
    });
    
    return () => {
      console.log(`[SCOREBOARD_STAT] Removing player stats listener for match ${matchId}, player ${playerId}`);
      unsubscribe();
    }
  }, [matchId, playerId, propStats]);
  
  // Load team color if teamId is provided
  useEffect(() => {
    if (teamId) {
      getTeamById(teamId).then(team => {
        if (team && team.teamColor) {
          setTeamColor(team.teamColor);
        }
      });
    }
  }, [teamId]);
  
  // Calculate totals - digs, tips, dumps are earned points now
  const totalEarnedPoints = (stats.aces || 0) + (stats.spikes || 0) + (stats.blocks || 0) +
    (stats.digs || 0) + (stats.tips || 0) + (stats.dumps || 0);
  // Reaches are now faults
  const totalFaults = (stats.serveErrors || 0) + (stats.spikeErrors || 0) + 
    (stats.netTouches || 0) + (stats.footFaults || 0) + (stats.carries || 0) +
    (stats.reaches || 0);
  
  const hasStats = totalEarnedPoints > 0 || totalFaults > 0;
  
  return (
    <div 
      className="border border-gray-200 rounded-lg p-4"
      style={teamColor ? { borderColor: teamColor } : {}}
    >
      <h5 className="font-semibold mb-2" style={teamColor ? { color: teamColor } : {}}>
        {player.name}
      </h5>
      
      {isLoading ? (
        <div className="text-center py-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></span>
          <span className="ml-2 text-sm text-gray-500">Loading stats...</span>
        </div>
      ) : hasStats ? (
        <>
          <div className="flex space-x-2 mb-3">
            <div className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium">
              Points: {totalEarnedPoints}
            </div>
            <div className="px-2 py-1 bg-red-100 text-red-800 rounded-md text-xs font-medium">
              Faults: {totalFaults}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats).map(([key, value]) => {
              if (value > 0) {
                const statName = key as keyof PlayerStats;
                return (
                  <div 
                    key={key} 
                    className={`flex items-center py-1 px-2 rounded text-white text-xs ${getStatCategoryColor(statName)}`}
                    title={`${statName}: ${value}`}
                  >
                    <span className="mr-1">{getStatEmoji(statName)}</span>
                    <span className="capitalize">{statName}: {value}</span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-500">No recorded stats for this player</div>
      )}
    </div>
  );
};

export default ScoreboardStatCard;