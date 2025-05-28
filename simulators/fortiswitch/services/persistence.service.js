import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../../config/config.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PersistenceService {
  constructor() {
    this.state = {
      switches: new Map(),
      vlans: new Map(),
      users: new Map(),
      stpInstances: new Map(),
      lldpNeighbors: new Map(),
      lastUpdated: new Date().toISOString(),
    };
    
    this.autoSaveInterval = null;
    this.initialize();
  }
  
  async initialize() {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '../../data');
    await fs.ensureDir(dataDir);
    
    // Set up auto-save if enabled
    if (config.persistence.enabled) {
      this.autoSaveInterval = setInterval(
        () => this.saveState(),
        config.persistence.autoSaveInterval
      );
      
      // Load existing state if available
      await this.loadState();
    }
  }
  
  getState() {
    return this.state;
  }
  
  updateState(updater) {
    const newState = { ...this.state };
    updater(newState);
    this.state = newState;
    this.state.lastUpdated = new Date().toISOString();
    
    if (config.persistence.enabled) {
      // Defer save to avoid blocking the main thread
      setImmediate(() => this.saveState().catch(err => {
        logger.error('Failed to auto-save state', { error: err.message });
      }));
    }
    
    return this.state;
  }
  
  async saveState() {
    if (!config.persistence.enabled) return;
    
    try {
      const stateToSave = {
        ...this.state,
        switches: Array.from(this.state.switches.entries()),
        vlans: Array.from(this.state.vlans.entries()),
        users: Array.from(this.state.users.entries()),
        stpInstances: Array.from(this.state.stpInstances.entries()),
        lldpNeighbors: Array.from(this.state.lldpNeighbors.entries()),
      };
      
      await fs.writeJson(config.persistence.filePath, stateToSave, { spaces: 2 });
      logger.debug('State saved successfully');
    } catch (error) {
      logger.error('Failed to save state', { error: error.message });
      throw error;
    }
  }
  
  async loadState() {
    if (!config.persistence.enabled) return;
    
    try {
      if (await fs.pathExists(config.persistence.filePath)) {
        const savedState = await fs.readJson(config.persistence.filePath);
        
        // Convert arrays back to Maps
        this.state = {
          switches: new Map(savedState.switches || []),
          vlans: new Map(savedState.vlans || []),
          users: new Map(savedState.users || []),
          stpInstances: new Map(savedState.stpInstances || []),
          lldpNeighbors: new Map(savedState.lldpNeighbors || []),
          lastUpdated: savedState.lastUpdated || new Date().toISOString(),
        };
        
        logger.info(`State loaded successfully from ${config.persistence.filePath}`);
        return true;
      }
      logger.info('No saved state found, starting with fresh state');
      return false;
    } catch (error) {
      logger.error('Failed to load state', { error: error.message });
      return false;
    }
  }
  
  // Clean up resources
  async shutdown() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    // Perform final save on shutdown
    if (config.persistence.enabled) {
      await this.saveState();
    }
  }
}

// Export a singleton instance
export default new PersistenceService();
