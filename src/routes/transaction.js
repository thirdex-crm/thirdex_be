import { Router } from 'express'
import { asyncHandler } from '../utils/asyncWrapper.js'
import {
  addTransaction,
  editTransaction,
  filter,
  getAllTransaction,
  deleteTransaction,
  getTransactionwithPagination,
  getTransactionById,
  bulkUploadTransactions
} from '../controllers/transaction.js'

const router = Router()

router.post('/addtransaction', asyncHandler(addTransaction))
router.get('/getalltransaction', asyncHandler(getAllTransaction))
router.get('/filter', asyncHandler(filter))
router.put('/edit_transaction/:id', asyncHandler(editTransaction))
router.put('/delete_transaction/:id', asyncHandler(deleteTransaction))
router.get('/allwithpagination', asyncHandler(getTransactionwithPagination))
router.get('/transactionbyid/:id', asyncHandler(getTransactionById))
router.post('/bulkUpload', asyncHandler(bulkUploadTransactions))

export default router
