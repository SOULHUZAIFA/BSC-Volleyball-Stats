import { 
  users, type User, type InsertUser,
  players, type Player_DB, type InsertPlayer,
  teams, type Team_DB, type InsertTeam,
  teamPlayers, type TeamPlayer, type InsertTeamPlayer,
  matches, type Match_DB, type InsertMatch,
  playerStats, type PlayerStat_DB, type InsertPlayerStat
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, sql } from "drizzle-orm";
import connectPgSimple from "connect-pg-simple";
import session from "express-session";
import { pool } from "./db";

const PostgresSessionStore = connectPgSimple(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserAccessLevel(id: number, accessLevel: "full" | "limited"): Promise<User | undefined>;
  
  // Player methods
  getPlayer(id: number): Promise<Player_DB | undefined>;
  getPlayers(): Promise<Player_DB[]>;
  createPlayer(player: InsertPlayer): Promise<Player_DB>;
  
  // Team methods
  getTeam(id: number): Promise<Team_DB | undefined>;
  getTeams(): Promise<Team_DB[]>;
  createTeam(team: InsertTeam): Promise<Team_DB>;
  
  // Team-Player assignments
  assignPlayerToTeam(teamPlayer: InsertTeamPlayer): Promise<TeamPlayer>;
  getTeamPlayers(teamId: number): Promise<Player_DB[]>;
  
  // Match methods
  getMatch(id: number): Promise<Match_DB | undefined>;
  getMatches(): Promise<Match_DB[]>;
  getMatchesByCourtNumber(courtNumber: number): Promise<Match_DB[]>;
  createMatch(match: InsertMatch): Promise<Match_DB>;
  updateMatchScore(id: number, scoreA: number, scoreB: number): Promise<Match_DB | undefined>;
  
  // Player Stats methods
  getPlayerStat(matchId: number, playerId: number): Promise<PlayerStat_DB | undefined>;
  getMatchStats(matchId: number): Promise<PlayerStat_DB[]>;
  createPlayerStat(stat: InsertPlayerStat): Promise<PlayerStat_DB>;
  updatePlayerStat(matchId: number, playerId: number, updates: Partial<InsertPlayerStat>): Promise<PlayerStat_DB | undefined>;
  
  // Session store for authentication
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserAccessLevel(id: number, accessLevel: "full" | "limited"): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ accessLevel })
      .where(eq(users.id, id))
      .returning();
    return user;
  }
  
  // Player methods
  async getPlayer(id: number): Promise<Player_DB | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player;
  }
  
  async getPlayers(): Promise<Player_DB[]> {
    return await db.select().from(players);
  }
  
  async createPlayer(player: InsertPlayer): Promise<Player_DB> {
    const [newPlayer] = await db.insert(players).values(player).returning();
    return newPlayer;
  }
  
  // Team methods
  async getTeam(id: number): Promise<Team_DB | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }
  
  async getTeams(): Promise<Team_DB[]> {
    return await db.select().from(teams);
  }
  
  async createTeam(team: InsertTeam): Promise<Team_DB> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }
  
  // Team-Player assignments
  async assignPlayerToTeam(teamPlayer: InsertTeamPlayer): Promise<TeamPlayer> {
    const [assignment] = await db.insert(teamPlayers).values(teamPlayer).returning();
    return assignment;
  }
  
  async getTeamPlayers(teamId: number): Promise<Player_DB[]> {
    const assignments = await db.select()
      .from(teamPlayers)
      .where(eq(teamPlayers.teamId, teamId));
    
    const playerIds = assignments.map(a => a.playerId);
    
    if (playerIds.length === 0) {
      return [];
    }
    
    return await db.select()
      .from(players)
      .where(inArray(players.id, playerIds));
  }
  
  // Match methods
  async getMatch(id: number): Promise<Match_DB | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match;
  }
  
  async getMatches(): Promise<Match_DB[]> {
    return await db.select().from(matches);
  }
  
  async getMatchesByCourtNumber(courtNumber: number): Promise<Match_DB[]> {
    return await db.select().from(matches).where(eq(matches.courtNumber, courtNumber));
  }
  
  async createMatch(match: InsertMatch): Promise<Match_DB> {
    const [newMatch] = await db.insert(matches).values(match).returning();
    return newMatch;
  }
  
  async updateMatchScore(id: number, scoreA: number, scoreB: number): Promise<Match_DB | undefined> {
    const [updatedMatch] = await db.update(matches)
      .set({ scoreA, scoreB })
      .where(eq(matches.id, id))
      .returning();
    return updatedMatch;
  }
  
  // Player Stats methods
  async getPlayerStat(matchId: number, playerId: number): Promise<PlayerStat_DB | undefined> {
    const [stat] = await db.select()
      .from(playerStats)
      .where(and(
        eq(playerStats.matchId, matchId),
        eq(playerStats.playerId, playerId)
      ));
    return stat;
  }
  
  async getMatchStats(matchId: number): Promise<PlayerStat_DB[]> {
    return await db.select()
      .from(playerStats)
      .where(eq(playerStats.matchId, matchId));
  }
  
  async createPlayerStat(stat: InsertPlayerStat): Promise<PlayerStat_DB> {
    const [newStat] = await db.insert(playerStats).values(stat).returning();
    return newStat;
  }
  
  async updatePlayerStat(matchId: number, playerId: number, updates: Partial<InsertPlayerStat>): Promise<PlayerStat_DB | undefined> {
    const [updatedStat] = await db.update(playerStats)
      .set(updates)
      .where(and(
        eq(playerStats.matchId, matchId),
        eq(playerStats.playerId, playerId)
      ))
      .returning();
    return updatedStat;
  }
}

export const storage = new DatabaseStorage();
