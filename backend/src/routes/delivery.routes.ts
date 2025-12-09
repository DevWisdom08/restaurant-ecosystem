import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/delivery/assignments
 * Get assigned deliveries for driver
 */
router.get('/assignments', authenticateToken, authorizeRoles('driver'), async (req, res, next) => {
  try {
    res.status(501).json({
      success: false,
      message: 'Endpoint implementation coming in Week 2'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/delivery/:assignment_id/status
 * Update delivery status
 */
router.patch('/:assignment_id/status', authenticateToken, authorizeRoles('driver'), async (req, res, next) => {
  try {
    res.status(501).json({
      success: false,
      message: 'Endpoint implementation coming in Week 2'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

