import { useState, useEffect } from 'react';
import { getPlayers, createTeam, getTeams, updateTeam, deleteTeam, listenToPlayers, listenToTeams } from '@/lib/firebase';
import type { Player, Team } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, Save, X, Loader2, PlusCircle, Users, Palette } from 'lucide-react';

const CreateTeams = () => {
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#3B82F6'); // Default to blue
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamColor, setEditTeamColor] = useState('#3B82F6'); // Default to blue
  const [editSelectedPlayers, setEditSelectedPlayers] = useState<string[]>([]);
  const { toast } = useToast();

  // Load players - use a listener to keep data in sync
  useEffect(() => {
    setIsLoadingPlayers(true);
    
    // Set up listener for players collection
    const unsubscribe = listenToPlayers((playersData) => {
      console.log('Players data updated:', playersData);
      setPlayers(playersData);
      setIsLoadingPlayers(false);
    });
    
    // Clean up listener on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // Load teams - use a listener to keep data in sync
  useEffect(() => {
    setIsLoadingTeams(true);
    
    // Set up listener for teams collection
    const unsubscribe = listenToTeams((teamsData) => {
      console.log('Teams data updated:', teamsData);
      setTeams(teamsData);
      setIsLoadingTeams(false);
    });
    
    // Clean up listener on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    if (!teamName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a team name",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlayers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one player",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await createTeam(teamName, selectedPlayers, teamColor);
      
      // No need to update local state - Firebase listener will handle it
      
      toast({
        title: "Success",
        description: `Team "${teamName}" created successfully`,
      });
      
      // Reset form
      setTeamName('');
      setSelectedPlayers([]);
      setTeamColor('#3B82F6'); // Reset to default blue
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create team",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (team: Team) => {
    setEditingTeamId(team.id);
    setEditTeamName(team.teamName);
    setEditSelectedPlayers(team.players || []);
    setEditTeamColor(team.teamColor || '#3B82F6');
  };

  const handleCancelEdit = () => {
    setEditingTeamId(null);
    setEditTeamName('');
    setEditSelectedPlayers([]);
  };

  const handleSaveEdit = async () => {
    if (!editingTeamId || !editTeamName.trim() || editSelectedPlayers.length === 0) {
      toast({
        title: "Error",
        description: "Team name and player selection are required",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await updateTeam(editingTeamId, editTeamName, editSelectedPlayers, editTeamColor);
      
      // No need to update local state - Firebase listener will handle it
      
      toast({
        title: "Success",
        description: "Team updated successfully",
      });
      
      // Reset edit mode
      setEditingTeamId(null);
      setEditTeamName('');
      setEditSelectedPlayers([]);
      setEditTeamColor('#3B82F6'); // Reset to default blue
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update team",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async (teamId: string) => {
    if (isDeleting) return;
    
    if (!confirm("Are you sure you want to delete this team? This action cannot be undone.")) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      await deleteTeam(teamId);
      
      // No need to update local state - Firebase listener will handle it
      
      toast({
        title: "Success",
        description: "Team deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePlayerSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);
    setSelectedPlayers(selectedOptions);
  };

  const handleEditPlayerSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);
    setEditSelectedPlayers(selectedOptions);
  };

  if (isLoadingPlayers || isLoadingTeams) {
    return (
      <div className="text-center py-4">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        <p>Loading data...</p>
      </div>
    );
  }

  // Helper function to display player names
  const getPlayerNames = (playerIds: string[]) => {
    return playerIds
      .map(id => players[id]?.name || 'Unknown Player')
      .join(', ');
  };
  
  // Helper function to determine brightness of a color (for text contrast)
  const getBrightness = (hexColor: string): number => {
    // Remove # if present
    const hex = hexColor.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculate brightness using the formula
    // (0.299*R + 0.587*G + 0.114*B)
    return (0.299 * r + 0.587 * g + 0.114 * b);
  };

  return (
    <div className="space-y-8">
      {/* Team Management Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Team Management</h3>
        
        {/* Teams List */}
        <div className="border rounded-md overflow-hidden mb-8">
          <div className="bg-gray-100 px-4 py-2 font-medium flex">
            <div className="w-1/3">Team Name</div>
            <div className="w-1/2">Players</div>
            <div className="w-1/6 text-center">Actions</div>
          </div>
          
          {Object.keys(teams).length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No teams added yet
            </div>
          ) : (
            <div className="divide-y">
              {Object.entries(teams).map(([teamId, team]) => (
                <div key={teamId} className="px-4 py-3">
                  {editingTeamId === teamId ? (
                    // Edit mode
                    <div className="flex flex-col space-y-2">
                      <div className="flex space-x-2 items-center">
                        <input
                          type="text"
                          className="flex-grow px-3 py-1 border border-gray-300 rounded-md"
                          value={editTeamName}
                          onChange={(e) => setEditTeamName(e.target.value)}
                          placeholder="Team Name"
                        />
                        <button 
                          className="text-green-500 p-1 hover:bg-green-50 rounded" 
                          onClick={handleSaveEdit}
                          title="Save"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Save className="h-5 w-5" />
                          )}
                        </button>
                        <button 
                          className="text-gray-500 p-1 hover:bg-gray-100 rounded" 
                          onClick={handleCancelEdit}
                          title="Cancel"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center">
                          <Palette className="h-4 w-4 mr-1" />
                          Team Color:
                        </label>
                        <div className="flex items-center">
                          <input
                            type="color"
                            value={editTeamColor}
                            onChange={(e) => setEditTeamColor(e.target.value)}
                            className="w-8 h-8 p-0 border-0 rounded-md cursor-pointer"
                          />
                          <div 
                            className="ml-2 px-3 py-1 rounded" 
                            style={{ backgroundColor: editTeamColor, color: getBrightness(editTeamColor) < 128 ? 'white' : 'black' }}
                          >
                            {editTeamColor}
                          </div>
                        </div>
                      </div>
                      <select 
                        multiple 
                        className="w-full h-32 px-3 py-1 border border-gray-300 rounded-md text-sm"
                        value={editSelectedPlayers}
                        onChange={handleEditPlayerSelection}
                      >
                        {Object.entries(players).map(([id, player]) => (
                          <option key={id} value={id}>{player.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500">Hold Ctrl/Cmd to select multiple players</p>
                    </div>
                  ) : (
                    // Display mode
                    <div className="flex items-center">
                      <div className="w-1/3 flex items-center font-medium">
                        {team.teamColor && (
                          <div 
                            className="w-4 h-4 rounded-full mr-2" 
                            style={{ backgroundColor: team.teamColor }}
                            title={team.teamColor}
                          />
                        )}
                        {team.teamName}
                      </div>
                      <div className="w-1/2 text-sm text-gray-600 truncate" title={getPlayerNames(team.players || [])}>
                        {getPlayerNames(team.players || [])}
                      </div>
                      <div className="w-1/6 flex justify-center space-x-1">
                        <button 
                          className="text-blue-500 p-1 hover:bg-blue-50 rounded" 
                          onClick={() => handleEditClick({...team, id: teamId})}
                          title="Edit"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button 
                          className="text-red-500 p-1 hover:bg-red-50 rounded" 
                          onClick={() => handleDeleteClick(teamId)}
                          title="Delete"
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Create Team Form */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <PlusCircle className="h-5 w-5 mr-2" />
          Create New Team
        </h3>
        <div className="space-y-4 max-w-lg border rounded-md p-4 bg-gray-50">
          <div>
            <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
            <input 
              type="text" 
              id="teamName" 
              name="teamName" 
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[hsl(var(--vb-blue))] focus:border-[hsl(var(--vb-blue))]"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="teamColor" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Palette className="h-4 w-4 mr-1" />
              Team Color
            </label>
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="color"
                id="teamColor"
                name="teamColor"
                value={teamColor}
                onChange={(e) => setTeamColor(e.target.value)}
                className="w-10 h-10 p-0 border-0 rounded-md cursor-pointer"
              />
              <div 
                className="px-3 py-1 rounded text-sm"
                style={{ 
                  backgroundColor: teamColor, 
                  color: getBrightness(teamColor) < 128 ? 'white' : 'black',
                  minWidth: '80px',
                  textAlign: 'center'
                }}
              >
                {teamColor}
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="players" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Users className="h-4 w-4 mr-1" />
              Select Players
            </label>
            <select 
              multiple 
              id="players" 
              name="players" 
              className="w-full h-40 px-4 py-2 border border-gray-300 rounded-md focus:ring-[hsl(var(--vb-blue))] focus:border-[hsl(var(--vb-blue))]"
              value={selectedPlayers}
              onChange={handlePlayerSelection}
            >
              {Object.entries(players).map(([id, player]) => (
                <option key={id} value={id}>{player.name}</option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple players</p>
          </div>
          <button 
            className="bg-[hsl(var(--vb-blue))] text-white py-2 px-6 rounded-md hover:bg-blue-700 transition flex items-center justify-center"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSubmitting ? 'Creating Team...' : 'Create Team'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTeams;
