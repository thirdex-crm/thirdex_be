import { regexFilter } from "../core/common/common.js"
import { errorCodes, Message, statusCodes } from "../core/common/constant.js"
import Attendees from "../models/attendees.js"
import CustomError from "../utils/exception.js"
import { isExistSession } from "./session.js"
import { isExistUser } from "./user.js"

export const addAttendee = async (attendeesData) => {
    const checkUserExistance = await isExistUser(attendeesData?.userId);
    if (!checkUserExistance) {
        throw new CustomError(
            statusCodes?.badRequest,
            Message?.userNotFound,
            errorCodes?.bad_request
        );
    }

    const checkSessionExistance = await isExistSession(attendeesData?.sessionId);
    if (!checkSessionExistance) {
        throw new CustomError(
            statusCodes?.badRequest,
            Message?.sessionNotFound,
            errorCodes?.bad_request
        );
    }

    const existingAttendance = await Attendees.findOne({
        attendee: attendeesData?.userId,
        session: attendeesData?.sessionId,
    });

    if (existingAttendance) {
        throw new CustomError(
            statusCodes?.conflict,
            Message?.userAlreadyInSession,
            errorCodes?.conflict
        );
    }

    const attendeesPayload = {
        attendee: attendeesData?.userId,
        session: attendeesData?.sessionId,
    };

    const attendeesSchema = new Attendees(attendeesPayload);
    return await attendeesSchema.save();
};

export const getAllAttendees = async () => {
    return await Attendees.find()
        .populate("attendee")
        .populate("session")
        .sort({ createdAt: -1 })
}


export const getAttendees = async (query) => {
    const { search, status, country, name, uniqueId, page = 1, limit = 10 } = query || {}
    let pageNumber = Number(page)
    let limitNumber = Number(limit)
    if (pageNumber < 1) {
        pageNumber = 1
    }

    if (limitNumber < 1) {
        limitNumber = 10
    }
    const skip = (pageNumber - 1) * limitNumber
    const searchKeys = {}
    const searchConditions = Object.entries(regexFilter(searchKeys)).map(
        ([key, value]) => ({
            [key]: value,
        })
    )
    const filter = {
        isCompletlyDelete: false,
        $or: searchConditions,
    }

    let attendeesData = await Attendees.find(filter)
        .populate("attendee")
        .populate("session")
        .sort({ createdAt: -1 })
        .notDeleted()

    // In-memory filtering on populated attendee data
    if (country) {
        attendeesData = attendeesData.filter(a =>
            a.attendee?.contactInfo?.country?.toLowerCase() === country.toLowerCase()
        )
    }
    if (name) {
        attendeesData = attendeesData.filter(a =>
            a.attendee?._id?.toString() === name
        )
    }
    if (uniqueId) {
        attendeesData = attendeesData.filter(a =>
            a.attendee?._id?.toString() === uniqueId
        )
    }

    const total = attendeesData.length
    const paginatedData = attendeesData.slice(skip, skip + limitNumber)

    return {
        data: paginatedData,
        meta: {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(total / limitNumber),
        },
    }

}


export const getAttendeeBySession = async ({ params, query }) => {
    const { sessionId } = params;
    const { search, status, page = 1, limit = 5 } = query || {};

    // Rest of your implementation remains the same
    let pageNumber = Number(page);
    let limitNumber = Number(limit);

    if (pageNumber < 1) pageNumber = 1;
    if (limitNumber < 1) limitNumber = 5;

    const skip = (pageNumber - 1) * limitNumber;

    const filter = {
        session: sessionId,
        isDelete: { $ne: true }
    };

    if (search) {
        const searchKeys = {};
        const searchConditions = Object.entries(regexFilter(searchKeys)).map(
            ([key, value]) => ({ [key]: value })
        );

        filter.$and = [
            ...searchConditions,
            { session: sessionId },
            { isDelete: { $ne: true } }
        ];
    }

    const attendeesData = await Attendees.find(filter)
        .populate("attendee")
        .populate("session")
        .skip(skip)
        .limit(limitNumber)
        .sort({ _id: -1 })
        .notDeleted();

    const total = await Attendees.countDocuments(filter);

    return {
        data: attendeesData,
        meta: {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(total / limitNumber),
        },
    };
};



export const deleteAttendees = async (sessionId, attendeeId) => {
    const checkExist = await Attendees.findOne({ session: sessionId, _id: attendeeId });

    if (!checkExist) {
        throw new CustomError(
            statusCodes?.notFound,
            Message?.notFound,
            errorCodes?.not_found
        );
    }
    const statusUpdate = await Attendees.findOneAndDelete({ session: sessionId, _id: attendeeId });

    if (!statusUpdate) {
        throw new CustomError(
            statusCodes?.notFound,
            Message?.notUpdate,
            errorCodes?.not_found
        );
    }

    return { statusUpdate };
};
