const mongoose = require("mongoose");

const modulePermissionSchema = new mongoose.Schema({
  view: Boolean,
  add: Boolean,
  edit: Boolean,
  delete: Boolean,
  assign: Boolean,
  approve: Boolean
}, { _id: false });

const permissionSchema = new mongoose.Schema({

  leads: modulePermissionSchema,
  projects: modulePermissionSchema,
  bookings: modulePermissionSchema,
  payments: modulePermissionSchema,
  siteVisits: modulePermissionSchema,
  customers: modulePermissionSchema,
  invoices: modulePermissionSchema

}, { _id: false });

const staffRoleSchema = new mongoose.Schema({

  roleName: {
    type: String,
    unique: true
  },

  permissions: permissionSchema

});

module.exports = mongoose.model("StaffRole", staffRoleSchema);