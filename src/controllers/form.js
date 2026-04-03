import * as formService from '../services/form.js'

export const deleteForm = async (req, res, next) => {
    const { formId } = req?.params;
    const result = await formService.deleteForm(formId);
    res.status(200).send(result);
};

export const updateForm = async (req, res, next) => {
    const { formId } = req?.params;
    const fields = req?.body;
    const update = await formService.updateForm(formId, fields);
    res.status(200).send(update);
};

export const addForm = async (req, res, next) => {
    const fields = req?.body
    const add = await formService.addForm(fields)
    res.status(200).send(add)
}

export const getFormById = async (req, res, next) => {
    const { formId } = req?.params
    const getFormById = await formService.getFormById(formId)
    res.status(200).send(getFormById)
}

export const getAllForms = async (req, res, next) => {
    const query = req?.query || {}
    const getAllForms = await formService.getAllForms(query)
    res.status(200).send(getAllForms)
}