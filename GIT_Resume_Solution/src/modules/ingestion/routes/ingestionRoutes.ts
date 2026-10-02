import { Router } from 'express';
import { ingestionController } from '../controllers/ingestionController';
import { upload } from '../config/multerConfig';

const router = Router();

router.get('/resume/health', ingestionController.healthCheck);
router.post('/resume/upload', upload.single('file'), ingestionController.uploadResume);
router.post('/resume/ingest', upload.single('file'), ingestionController.ingestResume);
router.post('/resume/extract', upload.single('file'), ingestionController.extractResume);
router.post('/resume/clean', ingestionController.cleanResumeText);
router.post('/resume/skills', ingestionController.detectSkills);
router.post('/resume/parse', ingestionController.parseResume);
router.post('/resume/embed', ingestionController.generateEmbedding);
router.post('/resume/store', ingestionController.storeResume);

export default router;
