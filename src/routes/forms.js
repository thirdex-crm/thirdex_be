import express from 'express';
import {
    addForm,
    getFormById,
    getAllForms,
    updateForm,
    deleteForm
} from '../controllers/form.js';
import { asyncHandler } from '../utils/asyncWrapper.js';

const router = express.Router();

router.post('/', asyncHandler(addForm));
router.get('/getallforms', asyncHandler(getAllForms));
router.put('/:formId', asyncHandler(updateForm));
router.delete('/:formId', asyncHandler(deleteForm));
router.get('/:formId', asyncHandler(getFormById));

export default router;
