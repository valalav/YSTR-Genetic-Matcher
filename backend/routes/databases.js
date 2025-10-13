const express = require('express');
const { executeQuery } = require('../config/database');
const { asyncHandler } = require('../middleware/validation');

const router = express.Router();

// GET /api/databases/haplogroups - Get list of available haplogroups
router.get('/haplogroups',
  asyncHandler(async (req, res) => {
    const { minProfiles = 0, sortBy = 'total_profiles', order = 'desc' } = req.query;

    const validSortColumns = ['haplogroup', 'total_profiles', 'avg_markers', 'loaded_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'total_profiles';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const query = `
      SELECT
        haplogroup,
        total_profiles,
        avg_markers,
        loaded_at,
        updated_at,
        status,
        source_file,
        description
      FROM haplogroup_databases
      WHERE status = 'active' AND total_profiles >= $1
      ORDER BY ${sortColumn} ${sortOrder}
    `;

    const result = await executeQuery(query, [minProfiles]);

    res.json({
      success: true,
      haplogroups: result.rows,
      total_count: result.rows.length,
      filters: {
        minProfiles,
        sortBy: sortColumn,
        order: sortOrder
      }
    });
  })
);

// GET /api/databases/haplogroup-stats/:haplogroup - Get statistics for a specific haplogroup
router.get('/haplogroup-stats/:haplogroup',
  asyncHandler(async (req, res) => {
    const { haplogroup } = req.params;

    const statsQuery = `
      SELECT
        hd.haplogroup,
        hd.total_profiles,
        hd.avg_markers,
        hd.loaded_at,
        hd.description,
        COUNT(DISTINCT yp.country) as countries,
        array_agg(DISTINCT yp.country) FILTER (WHERE yp.country IS NOT NULL AND yp.country != '') as country_list
      FROM haplogroup_databases hd
      LEFT JOIN ystr_profiles yp ON yp.haplogroup = hd.haplogroup
      WHERE hd.haplogroup = $1
      GROUP BY hd.haplogroup, hd.total_profiles, hd.avg_markers, hd.loaded_at, hd.description
    `;

    const result = await executeQuery(statsQuery, [haplogroup]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Haplogroup not found'
      });
    }

    res.json({
      success: true,
      statistics: result.rows[0]
    });
  })
);

// GET /api/databases/stats - Get overall database statistics
router.get('/stats',
  asyncHandler(async (req, res) => {
    const queries = [
      // Total statistics
      `SELECT
         COUNT(*) as total_profiles,
         COUNT(DISTINCT haplogroup) as unique_haplogroups,
         AVG((SELECT COUNT(*) FROM jsonb_object_keys(markers))) as avg_markers_per_profile
       FROM ystr_profiles`,

      // Top haplogroups
      `SELECT
         haplogroup,
         total_profiles,
         avg_markers,
         description
       FROM haplogroup_databases
       WHERE status = 'active'
       ORDER BY total_profiles DESC
       LIMIT 10`
    ];

    const [totalStats, topHaplogroups] = await Promise.all(
      queries.map(query => executeQuery(query))
    );

    res.json({
      success: true,
      statistics: {
        ...totalStats.rows[0],
        topHaplogroups: topHaplogroups.rows
      }
    });
  })
);

module.exports = router;
