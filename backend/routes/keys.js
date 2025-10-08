const express = require('express');
const crypto = require('crypto');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { requireMasterKey, hashApiKey, logAudit } = require('../middleware/apiKeyAuth');
const { validateRequest, asyncHandler } = require('../middleware/validation');

const router = express.Router();

// Validation schemas
const createKeySchema = Joi.object({
  name: Joi.string().required().max(100),
  description: Joi.string().allow('').max(500),
  permissions: Joi.object().required(),
  expiresInDays: Joi.number().integer().min(1).max(3650).optional()
});

const updateKeySchema = Joi.object({
  name: Joi.string().max(100),
  description: Joi.string().allow('').max(500),
  permissions: Joi.object(),
  isActive: Joi.boolean(),
  expiresInDays: Joi.number().integer().min(1).max(3650).optional()
}).min(1);

/**
 * POST /api/admin/keys - Create new API key
 * Requires master key
 */
router.post('/',
  requireMasterKey,
  validateRequest(createKeySchema),
  asyncHandler(async (req, res) => {
    const { name, description, permissions, expiresInDays } = req.body;

    // Generate random API key (32 bytes = 64 hex characters)
    const apiKey = crypto.randomBytes(32).toString('hex');
    const keyHash = hashApiKey(apiKey);

    // Calculate expiration date if specified
    let expiresAt = null;
    if (expiresInDays) {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + expiresInDays);
      expiresAt = expireDate.toISOString();
    }

    // Insert API key
    const query = `
      INSERT INTO api_keys (key_hash, name, description, permissions, created_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, description, permissions, created_at, expires_at, is_active
    `;

    const result = await executeQuery(query, [
      keyHash,
      name,
      description || '',
      JSON.stringify(permissions),
      'MASTER',
      expiresAt
    ]);

    const keyRecord = result.rows[0];

    // Log audit entry
    await logAudit(
      req,
      'CREATE',
      'api_keys',
      keyRecord.id.toString(),
      null,
      keyRecord,
      true
    );

    res.status(201).json({
      success: true,
      message: 'API key created successfully. Save the key securely - it will not be shown again.',
      apiKey: apiKey, // Only shown once!
      keyInfo: {
        id: keyRecord.id,
        name: keyRecord.name,
        description: keyRecord.description,
        permissions: keyRecord.permissions,
        createdAt: keyRecord.created_at,
        expiresAt: keyRecord.expires_at,
        isActive: keyRecord.is_active
      }
    });
  })
);

/**
 * GET /api/admin/keys - List all API keys
 * Requires master key
 */
router.get('/',
  requireMasterKey,
  asyncHandler(async (req, res) => {
    const { includeInactive } = req.query;

    let query = `
      SELECT
        id,
        name,
        description,
        permissions,
        created_by,
        created_at,
        expires_at,
        is_active,
        last_used_at,
        usage_count
      FROM api_keys
    `;

    if (!includeInactive || includeInactive === 'false') {
      query += ' WHERE is_active = true';
    }

    query += ' ORDER BY created_at DESC';

    const result = await executeQuery(query);

    res.json({
      success: true,
      keys: result.rows,
      total: result.rows.length
    });
  })
);

/**
 * GET /api/admin/keys/:id - Get specific API key details
 * Requires master key
 */
router.get('/:id',
  requireMasterKey,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await executeQuery(
      'SELECT * FROM api_keys WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'API key not found'
      });
    }

    res.json({
      success: true,
      key: result.rows[0]
    });
  })
);

/**
 * PUT /api/admin/keys/:id - Update API key
 * Requires master key
 */
router.put('/:id',
  requireMasterKey,
  validateRequest(updateKeySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Get existing key
    const existingQuery = await executeQuery(
      'SELECT * FROM api_keys WHERE id = $1',
      [id]
    );

    if (existingQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'API key not found'
      });
    }

    const oldData = existingQuery.rows[0];

    // Build UPDATE query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(updates.description);
    }
    if (updates.permissions !== undefined) {
      updateFields.push(`permissions = $${paramIndex++}`);
      updateValues.push(JSON.stringify(updates.permissions));
    }
    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      updateValues.push(updates.isActive);
    }
    if (updates.expiresInDays !== undefined) {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + updates.expiresInDays);
      updateFields.push(`expires_at = $${paramIndex++}`);
      updateValues.push(expireDate.toISOString());
    }

    updateValues.push(id);

    const query = `
      UPDATE api_keys
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await executeQuery(query, updateValues);
    const newData = result.rows[0];

    // Log audit entry
    await logAudit(
      req,
      'UPDATE',
      'api_keys',
      id,
      oldData,
      newData,
      true
    );

    res.json({
      success: true,
      message: 'API key updated successfully',
      key: newData
    });
  })
);

/**
 * DELETE /api/admin/keys/:id - Delete API key (or deactivate)
 * Requires master key
 */
router.delete('/:id',
  requireMasterKey,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { permanent } = req.query;

    // Get existing key
    const existingQuery = await executeQuery(
      'SELECT * FROM api_keys WHERE id = $1',
      [id]
    );

    if (existingQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'API key not found'
      });
    }

    const oldData = existingQuery.rows[0];

    if (permanent === 'true') {
      // Permanent deletion
      await executeQuery('DELETE FROM api_keys WHERE id = $1', [id]);

      await logAudit(
        req,
        'DELETE',
        'api_keys',
        id,
        oldData,
        null,
        true
      );

      res.json({
        success: true,
        message: 'API key permanently deleted'
      });
    } else {
      // Soft delete (deactivate)
      const result = await executeQuery(
        'UPDATE api_keys SET is_active = false WHERE id = $1 RETURNING *',
        [id]
      );

      await logAudit(
        req,
        'DEACTIVATE',
        'api_keys',
        id,
        oldData,
        result.rows[0],
        true
      );

      res.json({
        success: true,
        message: 'API key deactivated',
        key: result.rows[0]
      });
    }
  })
);

module.exports = router;
