import User from '../models/user.js';

export const getDuplicate = async () => {
  // Group 1: Duplicates matched by email
  const byEmail = await User.aggregate([
    {
      $match: {
        isDelete: false,
        "contactInfo.email": { $nin: [null, ""], $exists: true }
      }
    },
    {
      $group: {
        _id: { $toLower: { $trim: { input: "$contactInfo.email" } } },
        users: { $push: "$$ROOT" },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    {
      $project: {
        _id: 0,
        matchType: { $literal: "Email" },
        users: 1
      }
    }
  ]);

  // Group 2: Duplicates matched by firstName + lastName + dateOfBirth
  const byNameDob = await User.aggregate([
    {
      $match: {
        isDelete: false,
        "personalInfo.firstName": { $nin: [null, ""], $exists: true },
        "personalInfo.lastName": { $nin: [null, ""], $exists: true },
        "personalInfo.dateOfBirth": { $nin: [null, ""], $exists: true }
      }
    },
    {
      $group: {
        _id: {
          firstName: { $toLower: { $trim: { input: "$personalInfo.firstName" } } },
          lastName:  { $toLower: { $trim: { input: "$personalInfo.lastName" } } },
          dob: "$personalInfo.dateOfBirth"
        },
        users: { $push: "$$ROOT" },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    {
      $project: {
        _id: 0,
        matchType: { $literal: "Name & DOB" },
        users: 1
      }
    }
  ]);

  // Merge both lists, avoiding duplicate groups (same pair of user _ids appearing twice)
  const seen = new Set();
  const allGroups = [];

  for (const group of [...byEmail, ...byNameDob]) {
    const key = group.users
      .map(u => u._id.toString())
      .sort()
      .join('|');
    if (!seen.has(key)) {
      seen.add(key);
      allGroups.push(group);
    }
  }

  return allGroups;
};
