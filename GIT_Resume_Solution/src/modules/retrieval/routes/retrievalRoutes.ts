import { Router } from 'express';
import { retrievalController } from '../controllers/retrievalController';

const router = Router();

router.get('/retrieval/health', retrievalController.healthCheck);
router.get('/retrieval', retrievalController.listResumes);
router.get('/resume', retrievalController.listResumes);
router.post('/retrieval/search', retrievalController.searchResumes);
router.post('/resume/search', retrievalController.searchResumes);
router.post('/retrieval/top-match', retrievalController.getTopMatch);
router.post('/resume/top-match', retrievalController.getTopMatch);
router.get('/retrieval/:id', retrievalController.getResumeById);
router.get('/resume/:id', retrievalController.getResumeById);

export default router;
