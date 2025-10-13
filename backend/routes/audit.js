const express = require('express');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { requireMasterKey } = require('../middleware/apiKeyAuth');
const { validateRequest, asyncHandler } = require('../middleware/validation');

const router = express.Router();

// Validation schema for query parameters
const auditQuerySchema = Joi.object({
  apiKeyId: Joi.number().integer().optional(),
  operation: Joi.string().valid('CREATE', 'UPDATE', 'DELETE', 'DEACTIVATE').optional(),
  tableName: Joi.string().optional(),
  recordId: Joi.string().optional(),
  successOnly: Joi.boolean().optional(),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  offset: Joi.number().integer().min(0).default(0),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
});

/**
 * GET /api/admin/audit - Get audit log entries
 * Requires master key
 */
router.get('/',
  requireMasterKey,
  asyncHandler(async (req, res) => {
    const { error, value } = auditQuerySchema.validate(req.query);

    if (error) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.details
      });
    }

    const {
      apiKeyId,
      operation,
      tableName,
      recordId,
      successOnly,
      limit,
      offset,
      startDate,
      endDate
    } = value;

    // Build WHERE clause
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (apiKeyId !== undefined) {
      conditions.push(`al.api_key_id = $${paramIndex++}`);
      params.push(apiKeyId);
    }

    if (operation) {
      conditions.push(`al.operation = $${paramIndex++}`);
      params.push(operation);
    }

    if (tableName) {
      conditions.push(`al.table_name = $${paramIndex++}`);
      params.push(tableName);
    }

    if (recordId) {
      conditions.push(`al.record_id = $${paramIndex++}`);
      params.push(recordId);
    }

    if (successOnly) {
      conditions.push(`al.success = true`);
    }

    if (startDate) {
      conditions.push(`al.created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`al.created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_log al
      ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get audit entries with pagination
    const query = `
      SELECT
        al.id,
        al.created_at,
        al.operation,
        al.table_name,
        al.record_id,
        al.old_data,
        al.new_data,
        al.ip_address,
        al.user_agent,
        al.success,
        al.error_message,
        ak.name as api_key_name,
        ak.id as api_key_id
      FROM audit_log al
      LEFT JOIN api_keys ak ON al.api_key_id = ak.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await executeQuery(query, params);

    res.json({
      success: true,
      entries: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  })
);

/**
 * GET /api/admin/audit/:id - Get specific audit entry
 * Requires master key
 */
router.get('/:id',
  requireMasterKey,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const query = `
      SELECT
        al.*,
        ak.name as api_key_name
      FROM audit_log al
      LEFT JOIN api_keys ak ON al.api_key_id = ak.id
      WHERE al.id = $1
    `;

    const result = await executeQuery(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Audit entry not found'
      });
    }

    res.json({
      success: true,
      entry: result.rows[0]
    });
  })
);

/**
 * GET /api/admin/audit/stats - Get audit statistics
 * Requires master key
 */
router.get('/stats/summary',
  requireMasterKey,
  asyncHandler(async (req, res) => {
    const queries = [
      // Total entries
      `SELECT COUNT(*) as total_entries FROM audit_log`,

      // Entries by operation
      `SELECT
         operation,
         COUNT(*) as count,
         SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
         SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failure_count
       FROM audit_log
       GROUP BY operation
       ORDER BY count DESC`,

      // Entries by table
      `SELECT
         table_name,
         COUNT(*) as count
       FROM audit_log
       GROUP BY table_name
       ORDER BY count DESC`,

      // Recent activity (last 24 hours)
      `SELECT
         DATE_TRUNC('hour', created_at) as hour,
         COUNT(*) as count
       FROM audit_log
       WHERE created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY hour
       ORDER BY hour DESC`,

      // Top API keys by usage
      `SELECT
         ak.id,
         ak.name,
         COUNT(al.id) as operation_count,
         MAX(al.created_at) as last_operation
       FROM api_keys ak
       LEFT JOIN audit_log al ON ak.id = al.api_key_id
       GROUP BY ak.id, ak.name
       ORDER BY operation_count DESC
       LIMIT 10`
    ];

    const [
      totalResult,
      operationsResult,
      tablesResult,
      recentActivityResult,
      topKeysResult
    ] = await Promise.all(queries.map(q => executeQuery(q)));

    res.json({
      success: true,
      statistics: {
        totalEntries: parseInt(totalResult.rows[0].total_entries),
        byOperation: operationsResult.rows,
        byTable: tablesResult.rows,
        recentActivity: recentActivityResult.rows,
        topApiKeys: topKeysResult.rows
      }
    });
  })
);

/**
 * GET /api/admin/audit/export - Export audit log to CSV
 * Requires master key
 */
router.get('/export/csv',
  requireMasterKey,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    let whereClause = '';
    const params = [];

    if (startDate || endDate) {
      const conditions = [];
      let paramIndex = 1;

      if (startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        params.push(startDate);
      }
      if (endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        params.push(endDate);
      }

      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const query = `
      SELECT
        al.id,
        al.created_at,
        al.operation,
        al.table_name,
        al.record_id,
        ak.name as api_key_name,
        al.ip_address,
        al.success,
        al.error_message
      FROM audit_log al
      LEFT JOIN api_keys ak ON al.api_key_id = ak.id
      ${whereClause}
      ORDER BY al.created_at DESC
    `;

    const result = await executeQuery(query, params);

    // Convert to CSV
    const headers = ['ID', 'Date', 'Operation', 'Table', 'Record ID', 'API Key', 'IP Address', 'Success', 'Error'];
    const rows = result.rows.map(row => [
      row.id,
      row.created_at,
      row.operation,
      row.table_name,
      row.record_id || '',
      row.api_key_name || 'MASTER',
      row.ip_address || '',
      row.success ? 'Yes' : 'No',
      row.error_message || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_log_export.csv');
    res.send(csv);
  })
);

module.exports = router;
