import transaction from '../models/transaction.js'
import { errorCodes, Message, statusCodes } from '../core/common/constant.js'
import CustomError from '../utils/exception.js'
import { regexFilter } from '../core/common/common.js'
import mongoose from 'mongoose'
import UserTimeline from '../models/userTimeline.js'
import user from '../models/user.js'
import configuration from '../models/configuration.js'

const getConfigIdByName = async (name, configType) => {
  if (!name) return null;
  const config = await configuration.findOne({
    name: { $regex: `^${name.trim()}$`, $options: 'i' },
    configurationType: configType
  }).select('_id');
  return config?._id || null;
};
export const addTransaction = async (data) => {
  const newTransaction = await transaction.create(data)
  if (!newTransaction) {
    return new CustomError(
      statusCodes?.badRequest,
      Message?.notCreated,
      errorCodes?.bad_request
    )
  }

  await UserTimeline.findOneAndUpdate(
    { userId: newTransaction?.donorId },
    { $addToSet: { donationId: newTransaction._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { newTransaction }
}

export const getAllTransaction = async () => {
  const allTransaction = await transaction
    .find()
    .sort({ createdAt: -1 })
    .populate('donorId')
  if (!allTransaction) {
    throw new CustomError(
      statusCodes?.notFound,
      Message?.notFound,
      errorCodes?.not_found
    )
  }
  return { allTransaction }
}

export const filter = async (name, date, campaign) => {
  let filter = {}
  if (name) filter.assignedTo = name

  if (date) {
    const parsedDate = new Date(date)
    if (!isNaN(parsedDate)) {
      const start = new Date(parsedDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(parsedDate)
      end.setHours(23, 59, 59, 999)
      filter.createdAt = { $gte: start, $lte: end }
    }
  }
  if (campaign) filter.campaign = campaign

  const filterData = await transaction.find(filter)

  return filterData
}

export const editTransaction = async (id, transactionData) => {
  if (!id) {
    throw new CustomError(
      statusCodes?.badRequest,
      Message.notFound,
      errorCodes?.bad_request
    )
  }

  const existingTransaction = await transaction.findById(id)

  if (!existingTransaction) {
    throw new CustomError(
      statusCodes?.notFound,
      Message?.notFound,
      errorCodes?.not_found
    )
  }

  const updatedTransaction = await transaction.findByIdAndUpdate(
    id,
    { $set: transactionData },
    { new: true }
  )

  if (!updatedTransaction) {
    throw new CustomError(
      statusCodes?.badRequest,
      Message?.notUpdate,
      errorCodes?.bad_request
    )
  }

  return { updatedTransaction }
}

export const deleteTransaction = async (id) => {
  const transactionData = await transaction.findById(id)

  if (!transactionData) {
    throw new CustomError(
      statusCodes?.notFound,
      Message?.notFound,
      errorCodes?.not_found
    )
  }
  const updatedTransaction = await transaction.findByIdAndUpdate(
    id,
    { isDelete: true },
    { new: true }
  )

  if (!updatedTransaction) {
    throw new CustomError(
      statusCodes?.notFound,
      Message?.notUpdate,
      errorCodes?.not_found
    )
  }
  return { updatedTransaction }
}

export const getTransactionwithPagination = async (query) => {
  const {
    startDate,
    endDate,
    status,
    search,
    donorId,
    createdAt,
    campaign,
    name,
    uniqueId,
    deleted,
    page = 1,
    limit = 10,
  } = query || {}
  let pageNumber = Number(page)
  let limitNumber = Number(limit)
  if (pageNumber < 1) {
    pageNumber = 1
  }

  if (limitNumber < 1) {
    limitNumber = 10
  }
  const skip = (pageNumber - 1) * limitNumber
  const searchKeys = {
    donorId: search,
  }

  const searchConditions = Object.entries(regexFilter(searchKeys)).map(
    ([key, value]) => ({
      [key]: value,
    })
  )

  const filter = {
    isCompletlyDelete: false,
    ...(donorId !== undefined &&
      donorId !== '' && { donorId: new mongoose.Types.ObjectId(donorId) }),
    ...(typeof deleted !== 'undefined' ? { isDelete: deleted === 'true' } : { isDelete: false }),

    ...(campaign !== undefined && campaign !== '' && { campaign: campaign }),
     ...(startDate && endDate && {
      createdAt: {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      }
    }),
    ...(createdAt !== undefined &&
      createdAt !== '' && {
      createdAt: {
        $gte: new Date(createdAt),
        $lt: new Date(
          new Date(createdAt).setDate(new Date(createdAt).getDate() + 1)
        ),
      },
    }),

    ...(name !== undefined && name !== '' && { donorId: name }),
    ...(status !== undefined &&
      status !== '' && { isActive: status === 'true' }),
    ...(uniqueId !== undefined && uniqueId !== '' && { donorId: uniqueId }),
  }

  const allTransaction = await transaction
    .find(filter)
    .skip(skip)
    .limit(limitNumber)
    .sort({ createdAt: -1 })
    .populate('campaign')
    .populate('donorId')

  const filteredTransactions = search
    ? allTransaction.filter((c) => {
      const firstName =
        c.donorId?.personalInfo?.firstName?.toLowerCase() || ''
      const lastName = c.donorId?.personalInfo?.lastName?.toLowerCase() || ''
      const companyName =
        c.donorId?.companyInformation?.companyName?.toLowerCase() || ''
      const searchLower = search.toLowerCase()
      return (
        firstName.includes(searchLower) ||
        lastName.includes(searchLower) ||
        companyName.includes(searchLower)
      )
    })
    : allTransaction

  const paginatedTransactions = filteredTransactions.slice(
    skip,
    skip + limitNumber
  )
  return {
    data: paginatedTransactions,
    meta: {
      total: filteredTransactions.length,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(filteredTransactions.length / limitNumber),
    },
  }
}
export const getTransactionById= async (id) => {
   if (!id) {
    throw new CustomError(
      statusCodes?.badRequest,
      Message.notFound,
      errorCodes?.bad_request
    )
  }
  const allTransaction = await transaction
    .findById(id)
    .populate('campaign')
    .populate('donorId')
    .populate('currency')
    .populate('productId')
    .populate('paymentMethod')
  return {
    data: allTransaction,
  }
}

export const bulkUploadTransactions = async (transactions) => {
  const results = [];
  const errors = [];

  for (const data of transactions) {
    try {
      const donorId = data.donor_email
        ? (await user.findOne({ 'contactInfo.email': data.donor_email }).select('_id'))?._id
        : null;

      const [campaignId, paymentMethodId, currencyId, productIdVal] = await Promise.all([
        getConfigIdByName(data.campaign, 'Campaign'),
        getConfigIdByName(data.paymentMethod, 'Payment Method'),
        getConfigIdByName(data.currency, 'Currency'),
        getConfigIdByName(data.productId, 'Product'),
      ]);

      // Validate required config lookups before attempting save
      const rowErrors = [];
      if (!campaignId) rowErrors.push(`Campaign "${data.campaign}" not found in Configuration`);
      if (!paymentMethodId) rowErrors.push(`Payment Method "${data.paymentMethod}" not found in Configuration`);
      if (!data.amountPaid && data.amountPaid !== 0) rowErrors.push('amountPaid is required');

      if (rowErrors.length > 0) {
        errors.push({ row: data, error: rowErrors.join('; ') });
        continue;
      }

      const txData = {
        donorId: donorId || undefined,
        campaign: campaignId,
        amountPaid: parseFloat(data.amountPaid) || 0,
        paymentMethod: paymentMethodId,
        productId: productIdVal || undefined,
        processingCost: parseFloat(data.processingCost) || 0,
        currency: currencyId || undefined,
        receiptNumber: data.receiptNumber || undefined,
        transactionId: data.transactionId || undefined,
        amountDue: parseFloat(data.amountDue) || 0,
        quantity: parseInt(data.quantity) || 0,
      };

      const newTx = new transaction(txData);
      await newTx.save();

      if (donorId) {
        await UserTimeline.findOneAndUpdate(
          { userId: donorId },
          { $addToSet: { donationId: newTx._id } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }

      results.push(newTx);
    } catch (err) {
      console.error('Failed to save transaction:', data, err.message);
      errors.push({ row: data, error: err.message });
    }
  }

  return { results, errors };
};
