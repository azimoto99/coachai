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
    
    // Authentication middleware
    if (this.token) {
      this.app.use((req: Request, res: Response, next) => {
        const authToken = req.headers.authorization || req.body.auth?.token;
        if (authToken !== this.token) {
          logger.warn('Unauthorized GSI request');
          return res.status(401).send('Unauthorized');
        }
        next();
      });
    }

    // Logging middleware
    this.app.use((req: Request, res: Response, next) => {
      logger.debug(`GSI request: ${req.method} ${req.path}`);
      next();
    });
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
        
        if (!payload) {
          logger.warn('Received empty GSI payload');
          return res.status(400).send('Empty payload');
        }

        // Process the raw GSI data into structured format
        const processedState = gameStateProcessor.process(payload);
        
        // Notify subscribers
        if (this.onGameStateUpdate && processedState) {
          this.onGameStateUpdate(processedState);
        }

        res.status(200).send('OK');
      } catch (error) {
        logger.error('Error processing GSI payload:', error);
        res.status(500).send('Internal server error');
      }
    });

    // Heartbeat endpoint (GSI sends periodic heartbeats)
    this.app.post('/heartbeat', (req: Request, res: Response) => {
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
    });
  }

  public stop(): void {
    // Graceful shutdown if needed
    logger.info('GSI Server stopped');
  }
}

