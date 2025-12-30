/**
 * Game State Integration (GSI) Server
 * Receives game state data from Dota 2 client via HTTP POST
 */

import express, { Express, Request, Response } from 'express';
import { GSIPayload, ProcessedGameState } from '../types/gameState';
import { gameStateProcessor } from './gameStateProcessor';
import { logger } from '../utils/logger';

export class GSIServer {
  private app: Express;
  private port: number;
  private token: string;
  private onGameStateUpdate?: (gameState: ProcessedGameState) => void;

  constructor(port: number = 3000, token: string = '') {
    this.port = port;
    this.token = token;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Parse JSON with increased limit for GSI payloads
    this.app.use(express.json({ limit: '10mb' }));
    
    // Logging middleware - log all incoming requests (but skip for GET health checks)
    this.app.use((req: Request, res: Response, next) => {
      if (req.method === 'POST') {
        logger.info(`GSI request: ${req.method} ${req.path}`, {
          hasBody: !!req.body,
          bodyKeys: req.body ? Object.keys(req.body) : [],
          authInBody: !!req.body?.auth,
          authTokenInBody: req.body?.auth?.token ? 'present' : 'missing'
        });
      }
      next();
    });

    // Authentication middleware - only for POST requests
    if (this.token) {
      this.app.use((req: Request, res: Response, next) => {
        // Skip auth for GET requests (health check)
        if (req.method === 'GET') {
          return next();
        }

        // Dota 2 GSI sends token in body.auth.token (not Authorization header)
        const authToken = req.body?.auth?.token;
        
        // Log what we received for debugging
        logger.info('Checking authentication', {
          hasBody: !!req.body,
          hasAuth: !!req.body?.auth,
          authKeys: req.body?.auth ? Object.keys(req.body.auth) : [],
          receivedToken: authToken ? `${authToken.substring(0, 10)}...` : 'missing',
          expectedToken: `${this.token.substring(0, 10)}...`,
          fullBodyKeys: req.body ? Object.keys(req.body) : []
        });
        
        if (!authToken) {
          logger.warn('GSI request missing authentication token', {
            path: req.path,
            method: req.method,
            bodyKeys: req.body ? Object.keys(req.body) : [],
            hasAuth: !!req.body?.auth,
            authObject: req.body?.auth
          });
          return res.status(401).send('Unauthorized: Missing token');
        }
        
        if (authToken !== this.token) {
          logger.warn('Unauthorized GSI request - token mismatch', {
            path: req.path,
            receivedToken: authToken,
            expectedToken: this.token,
            receivedLength: authToken.length,
            expectedLength: this.token.length,
            tokensMatch: authToken === this.token
          });
          return res.status(401).send('Unauthorized: Invalid token');
        }
        
        logger.info('GSI request authenticated successfully');
        next();
      });
    } else {
      logger.warn('GSI Server running without authentication token - this is insecure!');
    }
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({ status: 'ok', service: 'Dota 2 GSI Server' });
    });

    // Main GSI endpoint - Dota 2 sends POST requests here
    this.app.post('/', (req: Request, res: Response) => {
      try {
        const payload: GSIPayload = req.body;
        
        logger.info('Received GSI payload', {
          hasProvider: !!payload.provider,
          hasMap: !!payload.map,
          hasPlayer: !!payload.player,
          hasHero: !!payload.hero,
          hasItems: !!payload.items,
          hasAbilities: !!payload.abilities,
          hasBuildings: !!payload.buildings,
          hasDraft: !!payload.draft
        });
        
        if (!payload) {
          logger.warn('Received empty GSI payload');
          return res.status(400).send('Empty payload');
        }

        // Process the raw GSI data into structured format
        const processedState = gameStateProcessor.process(payload);
        
        if (processedState) {
          logger.info('Processed game state', {
            gameState: processedState.gameState,
            gameTime: processedState.gameTime,
            hasPlayer: !!processedState.player,
            hasTeam: !!processedState.team
          });
        } else {
          logger.warn('Game state processor returned null');
        }
        
        // Notify subscribers
        if (this.onGameStateUpdate) {
          if (processedState) {
            logger.info('Calling onGameStateUpdate callback');
            this.onGameStateUpdate(processedState);
          } else {
            logger.warn('Not calling onGameStateUpdate - processedState is null');
          }
        } else {
          logger.warn('No onGameStateUpdate callback registered!');
        }

        res.status(200).send('OK');
      } catch (error) {
        logger.error('Error processing GSI payload:', error);
        res.status(500).send('Internal server error');
      }
    });

    // Heartbeat endpoint (GSI sends periodic heartbeats)
    this.app.post('/heartbeat', (req: Request, res: Response) => {
      logger.info('Received GSI heartbeat');
      res.status(200).send('OK');
    });
  }

  public onUpdate(callback: (gameState: ProcessedGameState) => void): void {
    this.onGameStateUpdate = callback;
  }

  public start(): void {
    this.app.listen(this.port, () => {
      logger.info(`GSI Server listening on port ${this.port}`);
      logger.info(`Make sure Dota 2 GSI config points to: http://localhost:${this.port}/`);
      if (this.token) {
        logger.info(`GSI Server expecting token: ${this.token.substring(0, 10)}... (length: ${this.token.length})`);
      } else {
        logger.warn('GSI Server has no authentication token configured!');
      }
    });
  }

  public stop(): void {
    // Graceful shutdown if needed
    logger.info('GSI Server stopped');
  }
}

