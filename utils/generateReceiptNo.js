const Payment = require("../models/Payment");

module.exports = async () => {

    const last = await Payment.findOne({})
        .sort({ createdAt: -1 });

    let number = 1;

    if (last?.receiptNo) {

        const lastNo = parseInt(
            last.receiptNo.replace("AHPL", "")
        );

        number = lastNo + 1;
    }

    return "PHPL" + String(number).padStart(6, "0");

};