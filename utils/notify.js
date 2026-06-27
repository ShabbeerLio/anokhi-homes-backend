const Notification = require("../models/Notification");
const User = require("../models/User");

/* ==========================================
   SEND TO SINGLE USER
========================================== */

const notifyUser = async ({
  user,
  sender = null,
  title,
  message,
  type,
  referenceId = null,
  referenceModel = "",
}) => {
  if (!user) return;

  await Notification.create({
    user,
    sender,
    title,
    message,
    type,
    referenceId,
    referenceModel,
  });
};

/* ==========================================
   SEND TO ALL ADMINS & STAFF
========================================== */

const notifyAdmins = async ({
  sender = null,
  title,
  message,
  type,
  referenceId = null,
  referenceModel = "",
}) => {
  const admins = await User.find({
    role: {
      $in: ["admin", "staff"],
    },
  }).select("_id");

  if (!admins.length) return;

  const notifications = admins.map((u) => ({
    user: u._id,
    sender,
    title,
    message,
    type,
    referenceId,
    referenceModel,
  }));

  await Notification.insertMany(notifications);
};

/* ==========================================
   SEND TO MULTIPLE USERS
========================================== */

const notifyMany = async ({
  users = [],
  sender = null,
  title,
  message,
  type,
  referenceId = null,
  referenceModel = "",
}) => {
  if (!users.length) return;

  const notifications = users.map((id) => ({
    user: id,
    sender,
    title,
    message,
    type,
    referenceId,
    referenceModel,
  }));

  await Notification.insertMany(notifications);
};

module.exports = {
  notifyUser,
  notifyAdmins,
  notifyMany,
};
