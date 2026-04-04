import Form from '../models/form.js';
import { errorCodes, Message, statusCodes } from '../core/common/constant.js'
import CustomError from '../utils/exception.js'

const getNextSurveyPublicId = async () => {
    const latestForm = await Form.findOne({ publicId: { $regex: '^surveyform-[0-9]+$' } })
        .sort({ createdAt: -1, _id: -1 })
        .select('publicId')
        .lean();

    const latestNumber = Number(latestForm?.publicId?.replace('surveyform-', ''));
    const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 10001;
    return `surveyform-${nextNumber}`;
};

export const addForm = async (fields) => {
    let setTitle
    const formatfields = fields?.formDataUpdated
        .map((f, index) => {
            if (f.type === 'header') {
                setTitle = f.label
            }
            return {
                id: index + 1,
                name: f.name || '',
                label: f.label || '',
                type: f.type || '',
                required: f.required || false,
                values: f.values,
                validation: f.validation || ''
            }
        })

    // Retry protects against concurrent inserts generating the same publicId.
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const publicId = await getNextSurveyPublicId();

        try {
            const form = new Form({
                title: setTitle || '',
                type: fields?.formValues?.formType || '',
                description: fields?.formValues?.description || '',
                fields: formatfields,
                publicId,
                records: fields?.formValues?.formRecord || ''
            });

            await form.save();
            return form;
        } catch (error) {
            if (error?.code === 11000 && error?.keyPattern?.publicId) {
                continue;
            }
            throw error;
        }
    }

    throw new CustomError(
        statusCodes?.badRequest,
        'Unable to generate a unique form ID. Please try again.',
        errorCodes?.bad_request
    );
}

export const getFormById = async (formId) => {
    const form = await Form.findOne({ publicId: formId });
    if (!form) {
        throw new CustomError(
            statusCodes?.notFound,
            Message?.notFound,
            errorCodes?.not_found
        )
    }
    return form
}

export const deleteForm = async (formId) => {
    const form = await Form.findOneAndDelete({ publicId: formId });
    if (!form) {
        throw new CustomError(statusCodes?.notFound, Message?.notFound, errorCodes?.not_found);
    }
    return { message: 'Form deleted successfully' };
};

export const updateForm = async (formId, fields) => {
    const form = await Form.findOne({ publicId: formId });
    if (!form) {
        throw new CustomError(statusCodes?.notFound, Message?.notFound, errorCodes?.not_found);
    }

    let setTitle = form.title;
    const formatfields = fields?.formDataUpdated?.map((f, index) => {
        if (f.type === 'header') {
            setTitle = f.label;
        }
        return {
            id: index + 1,
            name: f.name || '',
            label: f.label || '',
            type: f.type || '',
            required: f.required || false,
            values: f.values,
            validation: f.validation || ''
        };
    });

    form.title = setTitle;
    if (fields?.formValues?.formType) form.type = fields.formValues.formType;
    if (fields?.formValues?.description !== undefined) form.description = fields.formValues.description;
    if (fields?.formValues?.formRecord) form.records = fields.formValues.formRecord;
    if (formatfields && formatfields.length > 0) form.fields = formatfields;

    await form.save();
    return form;
};

export const getAllForms = async (query) => {

    const { page = 1, limit = 10, search, type, title, createdAt } = query || {}
    const skip = (page - 1) * limit;
    const filters = {
        ...(search && { title: { $regex: search, $options: 'i' } }),
        ...(title && { title: { $regex: title, $options: 'i' } }),
        ...(type && { type: { $regex: type, $options: 'i' } })
    };
    if (createdAt) {
        const parsedDate = new Date(createdAt)
        if (!isNaN(parsedDate)) {
            const start = new Date(parsedDate)
            start.setHours(0, 0, 0, 0)
            const end = new Date(parsedDate)
            end.setHours(23, 59, 59, 999)
            filters.createdAt = { $gte: start, $lte: end }
        }
    }
    const form = await Form
        .find(filters)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

    const total = await Form.countDocuments(filters);
    return {
        data: form,
        meta: {
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        }
    };
}