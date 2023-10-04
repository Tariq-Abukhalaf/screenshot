const express        = require('express');
const router         = express.Router();
const jobsController = require('../../controllers/jobs.controller');

/* POST */
router.get('/', jobsController.create);

module.exports = router;
