const crypto = require('crypto');
const { executeQuery } = require('../config/database');

/**
 * Middleware для проверки API ключей
 *
 * Usage:
 *   router.post('/api/samples', requireApiKey('samples.create'), handler);
 *   router.put('/api/samples/:id', requireApiKey('samples.update'), handler);
 */

// Hash API key using SHA-256
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// Extract API key from request
function extractApiKey(req) {
  // Try Authorization header first (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Try query parameter (less secure, but convenient for testing)
  if (req.query.apiKey) {
    return req.query.apiKey;
  }

  return null;
}

// Middleware factory function
function requireApiKey(requiredPermission = null) {
  return async (req, res, next) => {
    try {
      const apiKey = extractApiKey(req);

      if (!apiKey) {
        return res.status(401).json({
          error: 'API key required',
          message: 'Please provide an API key in Authorization header or X-API-Key header'
        });
      }

      // Check if this is the master API key - grant all permissions
      const masterKey = process.env.MASTER_API_KEY;
      if (masterKey && apiKey === masterKey) {
        req.apiKey = {
          id: null,
          name: 'MASTER',
          permissions: { '*': true }
        };
        return next();
      }

      const keyHash = hashApiKey(apiKey);

      // Check if API key is valid
      const validQuery = await executeQuery(
        'SELECT is_api_key_valid($1) as is_valid',
        [keyHash]
      );

      if (!validQuery.rows[0].is_valid) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'API key is invalid, expired, or inactive'
        });
      }

      // Get API key details and permissions
      const keyQuery = await executeQuery(
        `SELECT id, name, permissions
         FROM api_keys
         WHERE key_hash = $1
           AND is_active = true
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [keyHash]
      );

      if (keyQuery.rows.length === 0) {
        return res.status(401).json({
          error: 'API key not found'
        });
      }

      const apiKeyRecord = keyQuery.rows[0];

      // Check permission if required
      if (requiredPermission) {
        const permissions = apiKeyRecord.permissions || {};

        if (!permissions[requiredPermission]) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            message: `This API key does not have '${requiredPermission}' permission`,
            required: requiredPermission,
            available: Object.keys(permissions).filter(p => permissions[p])
          });
        }
      }

      // Attach API key info to request
      req.apiKey = {
        id: apiKeyRecord.id,
        name: apiKeyRecord.name,
        permissions: apiKeyRecord.permissions
      };

      next();
    } catch (error) {
      console.error('API key validation error:', error);
      res.status(500).json({
        error: 'Internal server error during authentication'
      });
    }
  };
}

// Middleware for master key (admin access)
function requireMasterKey(req, res, next) {
  const apiKey = extractApiKey(req);
  const masterKey = process.env.MASTER_API_KEY;

  if (!masterKey) {
    return res.status(500).json({
      error: 'Master API key not configured'
    });
  }

  if (!apiKey || apiKey !== masterKey) {
    return res.status(401).json({
      error: 'Master API key required',
      message: 'This endpoint requires the master API key'
    });
  }

  // Attach master key info to request
  req.apiKey = {
    id: null,
    name: 'MASTER',
    permissions: { '*': true }
  };

  next();
}

// Helper function to log audit entry
async function logAudit(req, operation, tableName, recordId, oldData = null, newData = null, success = true, errorMessage = null) {
  try {
    const apiKeyId = req.apiKey?.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await executeQuery(
      'SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        apiKeyId,
        operation,
        tableName,
        recordId?.toString(),
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        ipAddress,
        userAgent,
        success,
        errorMessage
      ]
    );
  } catch (error) {
    console.error('Failed to log audit entry:', error);
    // Don't throw - audit logging failure shouldn't break the request
  }
}

module.exports = {
  requireApiKey,
  requireMasterKey,
  hashApiKey,
  logAudit
};
