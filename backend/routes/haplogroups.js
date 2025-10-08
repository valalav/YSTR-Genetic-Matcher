const express = require('express');
const Joi = require('joi');
const { executeQuery } = require('../config/database');
const { validateRequest, asyncHandler } = require('../middleware/validation');
const haplogroupService = require('../services/haplogroupService');

const router = express.Router();

// Validation schemas
const predictHaplogroupSchema = Joi.object({
  markers: Joi.object().required().min(1),
  method: Joi.string().valid('yfull', 'ftdna', 'combined').default('combined'),
  confidence: Joi.number().min(0).max(1).default(0.7)
});

const searchHaplogroupSchema = Joi.object({
  haplogroup: Joi.string().required(),
  includeSubclades: Joi.boolean().default(true),
  depth: Joi.number().integer().min(1).max(10).default(3)
});

// GET /api/haplogroups - Get all haplogroups with hierarchy
router.get('/',
  asyncHandler(async (req, res) => {
    const query = `
      WITH RECURSIVE haplogroup_tree AS (
        -- Base case: root haplogroups
        SELECT
          id, haplogroup, parent_haplogroup, level, 0 as depth,
          ARRAY[haplogroup] as path
        FROM haplogroups
        WHERE parent_haplogroup IS NULL

        UNION ALL

        -- Recursive case: child haplogroups
        SELECT
          h.id, h.haplogroup, h.parent_haplogroup, h.level, ht.depth + 1,
          ht.path || h.haplogroup
        FROM haplogroups h
        INNER JOIN haplogroup_tree ht ON h.parent_haplogroup = ht.haplogroup
        WHERE ht.depth < 10  -- Prevent infinite recursion
      )
      SELECT
        haplogroup,
        parent_haplogroup,
        level,
        depth,
        path,
        (SELECT COUNT(*) FROM ystr_profiles p WHERE p.haplogroup = ht.haplogroup) as profile_count
      FROM haplogroup_tree ht
      ORDER BY path
    `;

    const result = await executeQuery(query);

    res.json({
      success: true,
      haplogroups: result.rows
    });
  })
);

// POST /api/haplogroups/predict - Predict haplogroup from markers
router.post('/predict',
  validateRequest(predictHaplogroupSchema),
  asyncHandler(async (req, res) => {
    const { markers, method, confidence } = req.body;

    const prediction = await haplogroupService.predictHaplogroup(markers, {
      method,
      minConfidence: confidence
    });

    res.json({
      success: true,
      prediction
    });
  })
);

// GET /api/haplogroups/:haplogroup/subclades - Get subclade tree
router.get('/:haplogroup/subclades',
  validateRequest(searchHaplogroupSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { haplogroup } = req.params;
    const { includeSubclades, depth } = req.query;

    let query;
    let params;

    if (includeSubclades) {
      // Get all subclades using recursive query
      query = `
        WITH RECURSIVE subclade_tree AS (
          -- Base case: the target haplogroup
          SELECT
            id, haplogroup, parent_haplogroup, level, 0 as depth
          FROM haplogroups
          WHERE haplogroup = $1

          UNION ALL

          -- Recursive case: all subclades
          SELECT
            h.id, h.haplogroup, h.parent_haplogroup, h.level, st.depth + 1
          FROM haplogroups h
          INNER JOIN subclade_tree st ON h.parent_haplogroup = st.haplogroup
          WHERE st.depth < $2
        )
        SELECT
          st.haplogroup,
          st.parent_haplogroup,
          st.level,
          st.depth,
          (SELECT COUNT(*) FROM ystr_profiles p WHERE p.haplogroup = st.haplogroup) as profile_count
        FROM subclade_tree st
        ORDER BY st.level, st.haplogroup
      `;
      params = [haplogroup, depth];
    } else {
      // Get only direct children
      query = `
        SELECT
          haplogroup,
          parent_haplogroup,
          level,
          1 as depth,
          (SELECT COUNT(*) FROM ystr_profiles p WHERE p.haplogroup = h.haplogroup) as profile_count
        FROM haplogroups h
        WHERE parent_haplogroup = $1
        ORDER BY haplogroup
      `;
      params = [haplogroup];
    }

    const result = await executeQuery(query, params);

    res.json({
      success: true,
      haplogroup,
      subclades: result.rows,
      includeSubclades,
      depth
    });
  })
);

// GET /api/haplogroups/:haplogroup/stats - Get statistics for haplogroup
router.get('/:haplogroup/stats',
  asyncHandler(async (req, res) => {
    const { haplogroup } = req.params;

    const queries = [
      // Direct count
      `SELECT COUNT(*) as direct_count FROM ystr_profiles WHERE haplogroup = $1`,

      // Subclade count
      `SELECT COUNT(*) as subclade_count
       FROM ystr_profiles p
       WHERE p.haplogroup LIKE $1 || '%' AND p.haplogroup != $1`,

      // Geographic distribution
      `SELECT country, COUNT(*) as count
       FROM ystr_profiles
       WHERE haplogroup LIKE $1 || '%' AND country IS NOT NULL AND country != ''
       GROUP BY country
       ORDER BY count DESC
       LIMIT 10`,

      // Common markers analysis
      `SELECT
         key as marker,
         COUNT(*) as total_profiles,
         COUNT(CASE WHEN value != '' THEN 1 END) as profiles_with_value,
         mode() WITHIN GROUP (ORDER BY value) as most_common_value
       FROM ystr_profiles, jsonb_each_text(markers)
       WHERE haplogroup LIKE $1 || '%'
       GROUP BY key
       HAVING COUNT(CASE WHEN value != '' THEN 1 END) > 5
       ORDER BY profiles_with_value DESC`
    ];

    const [directResult, subcladeResult, geoResult, markersResult] = await Promise.all(
      queries.map(query => executeQuery(query, [haplogroup]))
    );

    res.json({
      success: true,
      haplogroup,
      statistics: {
        directCount: parseInt(directResult.rows[0].direct_count),
        subcladeCount: parseInt(subcladeResult.rows[0].subclade_count),
        totalCount: parseInt(directResult.rows[0].direct_count) + parseInt(subcladeResult.rows[0].subclade_count),
        geographicDistribution: geoResult.rows,
        markerAnalysis: markersResult.rows
      }
    });
  })
);

// POST /api/haplogroups/bulk-update - Update haplogroup tree from external source
router.post('/bulk-update',
  asyncHandler(async (req, res) => {
    const { source = 'yfull' } = req.body;

    const result = await haplogroupService.updateHaplogroupTree(source);

    res.json({
      success: true,
      message: 'Haplogroup tree updated successfully',
      ...result
    });
  })
);

// GET /api/haplogroups/search/:term - Search haplogroups by name
router.get('/search/:term',
  asyncHandler(async (req, res) => {
    const { term } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const query = `
      SELECT
        haplogroup,
        parent_haplogroup,
        level,
        (SELECT COUNT(*) FROM ystr_profiles p WHERE p.haplogroup = h.haplogroup) as profile_count
      FROM haplogroups h
      WHERE haplogroup ILIKE $1
      ORDER BY
        CASE WHEN haplogroup = $2 THEN 0 ELSE 1 END,  -- Exact match first
        length(haplogroup),  -- Shorter matches first
        haplogroup
      LIMIT $3
    `;

    const result = await executeQuery(query, [`%${term}%`, term, limit]);

    res.json({
      success: true,
      searchTerm: term,
      results: result.rows
    });
  })
);

module.exports = router;