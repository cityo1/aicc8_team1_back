import express from 'express';
import userController from '../controllers/userController.js';

const router = express.Router();

// GET /api/users
// Note: userController.getUsers might need to be defined if still required
router.get('/', userController.getUsers || ((req, res) => res.send("getUsers not implemented")));

// POST /api/users
router.post('/', userController.signup); // Mapping old createUser to signup or keeping it if it existed

export default router;

