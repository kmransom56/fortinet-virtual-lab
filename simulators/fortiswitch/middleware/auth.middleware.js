import jwt from 'jsonwebtoken';
import config from '../../config/config.js';
import logger from '../utils/logger.js';
import persistenceService from '../services/persistence.service.js';

class AuthMiddleware {
  constructor() {
    this.requireAuth = this.requireAuth.bind(this);
    this.requireRole = this.requireRole.bind(this);
    this.requireApiKey = this.requireApiKey.bind(this);
  }

  // Require valid JWT token
  requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: No token provided');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret);
      req.user = decoded;
      next();
    } catch (error) {
      logger.warn(`Authentication failed: ${error.message}`, { error });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // Require specific role
  requireRole(roles) {
    if (!Array.isArray(roles)) {
      roles = [roles];
    }
    
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!roles.includes(req.user.role)) {
        logger.warn(`Authorization failed for user ${req.user.username}: Insufficient permissions`);
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      next();
    };
  }

  // API key authentication
  requireApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!apiKey) {
      logger.warn('API key authentication failed: No API key provided');
      return res.status(401).json({ error: 'API key required' });
    }
    
    if (!config.auth.apiKeys.includes(apiKey)) {
      logger.warn('API key authentication failed: Invalid API key');
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    next();
  }
  
  // Rate limiting middleware
  rateLimiter() {
    return (req, res, next) => {
      // Implement rate limiting logic here
      // This is a simplified version - in production, use express-rate-limit or similar
      const ip = req.ip;
      const now = Date.now();
      const windowMs = config.auth.rateLimit.windowMs;
      const max = config.auth.rateLimit.max;
      
      // Get or create rate limit entry for this IP
      const rateLimitKey = `rate_limit:${ip}`;
      const rateLimit = persistenceService.state.rateLimits?.get(rateLimitKey) || {
        count: 0,
        resetTime: now + windowMs,
      };
      
      // Check if window has passed, reset if needed
      if (now > rateLimit.resetTime) {
        rateLimit.count = 0;
        rateLimit.resetTime = now + windowMs;
      }
      
      // Check if rate limit exceeded
      if (rateLimit.count >= max) {
        const retryAfter = Math.ceil((rateLimit.resetTime - now) / 1000);
        res.set('Retry-After', retryAfter);
        return res.status(429).json({ 
          error: 'Too many requests',
          retryAfter: `${retryAfter} seconds`,
        });
      }
      
      // Increment counter
      rateLimit.count++;
      
      // Update rate limit in state
      persistenceService.updateState(state => {
        if (!state.rateLimits) {
          state.rateLimits = new Map();
        }
        state.rateLimits.set(rateLimitKey, rateLimit);
      });
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': max - rateLimit.count,
        'X-RateLimit-Reset': Math.ceil(rateLimit.resetTime / 1000),
      });
      
      next();
    };
  }
}

export default new AuthMiddleware();
