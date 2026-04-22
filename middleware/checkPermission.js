const StaffRole = require("../models/StaffRole");

const checkPermission = (module, action) => {

  return async (req, res, next) => {

    try {

      if (req.user.role === "admin") return next();

      const role = await StaffRole.findOne({
        roleName: req.user.staffRole
      });

      if (!role) {
        return res.status(403).json({
          msg: "Role permissions not found"
        });
      }

      const modulePermission = role.permissions[module];

      if (!modulePermission || !modulePermission[action]) {
        return res.status(403).json({
          msg: "Permission denied"
        });
      }

      next();

    } catch (error) {
      res.status(500).send("Server error");
    }

  };

};

module.exports = checkPermission;