const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String,

    email: {
      type: String,
      unique: true,
    },

    phone: String,

    password: String,

    role: {
      type: String,
      enum: ["admin", "agent", "staff", "user"],
      default: "user",
    },

    avatar: String,

    status: {
      type: String,
      enum: ["approval", "active", "inactive"],
      default: "approval",
    },

    address: String,

    panNumber: String,
    panPhoto: String,

    aadharNumber: String,
    aadharPhoto: String,

    bankName: String,
    accountNumber: String,
    ifsc: String,

    nomineeName: String,
    nomineeRelation: String,
    nomineeAadharNumber: String,
    nomineeAadharPhoto: String,

    staffRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffRole",
      default: null,
    },

    teamLeader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /* =================================
       MLM SYSTEM
    ================================= */

    referralId: {
      type: String,
      unique: true,
      sparse: true,
    },

    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    position: {
      type: String,
      enum: ["left", "right"],
    },

    leftChildren: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    rightChildren: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    level: {
      type: Number,
      default: 1,
      max: 16,
    },

    /* =================================
       BUSINESS
    ================================= */
    directIncomeBusinessProcessed: {
      type: Number,
      default: 0,
    },

    selfBusiness: {
      type: Number,
      default: 0,
    },

    leftBusiness: {
      type: Number,
      default: 0,
    },

    rightBusiness: {
      type: Number,
      default: 0,
    },

    totalBusiness: {
      type: Number,
      default: 0,
    },

    rewardBusinessAchieved: {
      type: Number,
      default: 0,
    },

    claimedRewardLevels: {
      type: [Number],
      default: [],
    },

    matchedBusiness: {
      type: Number,
      default: 0,
    },

    /* =================================
       DESIGNATION
    ================================= */

    designation: {
      type: String,
      default: "Sales Executive",
    },

    directIncomePercent: {
      type: Number,
      default: 5,
    },

    /* =================================
       WALLET
    ================================= */

    wallet: {
      type: Number,
      default: 0,
    },
    walletAvailable: {
      type: Number,
      default: 0,
    },

    walletHold: {
      type: Number,
      default: 0,
    },

    walletWithdrawn: {
      type: Number,
      default: 0,
    },

    totalIncome: {
      type: Number,
      default: 0,
    },

    totalWithdraw: {
      type: Number,
      default: 0,
    },

    cycle1Business: {
      type: Number,
      default: 0,
    },

    cycle2Business: {
      type: Number,
      default: 0,
    },

    /* =================================
       TEAM
    ================================= */

    totalTeam: {
      type: Number,
      default: 0,
    },

    directTeam: {
      type: Number,
      default: 0,
    },

    activeTeam: {
      type: Number,
      default: 0,
    },

    /* ==========================
   PERFORMANCE RATINGS
========================== */

    leadPoints: {
      type: Number,
      default: 0,
    },

    siteVisitPoints: {
      type: Number,
      default: 0,
    },

    bookingPoints: {
      type: Number,
      default: 0,
    },

    /* ==========================
   CUSTOMER RATINGS
========================== */

    customerRating: {
      type: Number,
      default: 0,
    },

    totalCustomerRatings: {
      type: Number,
      default: 0,
    },

    /* ==========================
   OVERALL
========================== */

    overallRating: {
      type: Number,
      default: 0,
    },

    badge: {
      type: String,
      default: "Starter",
    },
  },
  { timestamps: true },
);

/* =================================

   GENERATE REFERRAL ID

================================= */

userSchema.pre("save", async function () {
  // Only admin and agent get referralId

  if ((this.role === "admin" || this.role === "agent") && !this.referralId) {
    let isUnique = false;

    while (!isUnique) {
      const random = Math.floor(100000 + Math.random() * 900000);

      const referralCode = `PAH${random}`;

      const existingUser = await mongoose

        .model("User")

        .findOne({
          referralId: referralCode,
        });

      if (!existingUser) {
        this.referralId = referralCode;

        isUnique = true;
      }
    }
  }
});

module.exports = mongoose.model("User", userSchema);
