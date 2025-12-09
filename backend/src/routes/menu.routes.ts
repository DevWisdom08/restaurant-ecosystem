import { Router } from 'express';

const router = Router();

/**
 * GET /api/v1/menu/locations
 * Get all active locations
 */
router.get('/locations', async (req, res, next) => {
  try {
    // Implementation coming in Week 2
    res.status(501).json({
      success: false,
      message: 'Endpoint implementation coming in Week 2'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/menu/categories
 * Get all categories with items
 */
router.get('/categories', async (req, res, next) => {
  try {
    // Implementation coming in Week 2
    res.status(501).json({
      success: false,
      message: 'Endpoint implementation coming in Week 2'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

