const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const bwipjs = require("bwip-js");
const fs = require("fs");
const path = require("path");
const { toWords } = require("number-to-words");

module.exports = async function generateReceipt(
  res,
  payment,
  booking,
  customer,
  colony,
  plot,
) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
  });

  res.setHeader("Content-Type", "application/pdf");

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${payment.receiptNo}.pdf`,
  );

  doc.pipe(res);

  //--------------------------------------------------
  // LOGO
  //--------------------------------------------------

  const logo = path.join(__dirname, "../public/logo.png");

  if (fs.existsSync(logo)) {
    doc.image(logo, 40, 30, {
      width: 100,
    });
  }

  //--------------------------------------------------
  // TITLE
  //--------------------------------------------------

  doc.fontSize(22).font("Helvetica-Bold").text("PAYMENT e-RECEIPT", 200, 40);

  //--------------------------------------------------

  doc.moveTo(40, 110).lineTo(560, 110).stroke();

  //--------------------------------------------------
  // COMPANY
  //--------------------------------------------------

  doc
    .fontSize(10)
    .font("Helvetica")
    .text("Anokhi Homes Pvt. Ltd.", 40, 120)

    .text("406, Pandey Plaza", 40)

    .text("Exhibition Road", 40)

    .text("Patna - 800001", 40)

    .text("Phone : +91-8298554555", 40)

    .text("Email : info@anokhihomes.in", 40);

  //--------------------------------------------------
  // RECEIPT DETAILS
  //--------------------------------------------------

  doc
    .font("Helvetica-Bold")

    .text(`Receipt No : ${payment.receiptNo}`, 340, 120)

    .text(`Date : ${new Date(payment.createdAt).toLocaleString()}`, 340)

    .text(`Project : ${colony.name}`, 340);

  //--------------------------------------------------

  doc.moveTo(40, 205).lineTo(560, 205).stroke();

  //--------------------------------------------------
  // CUSTOMER
  //--------------------------------------------------

  doc.font("Helvetica-Bold");

  doc.text("CUSTOMER DETAILS", 40, 220);

  doc.font("Helvetica");

  doc.text(`Name : ${customer.name}`, 40, 245);

  doc.text(`Phone : ${customer.phone}`, 40);

  doc.text(`Customer ID : ${customer._id}`, 40);

  //--------------------------------------------------
  // PLOT
  //--------------------------------------------------

  doc.font("Helvetica-Bold");

  doc.text("PLOT DETAILS", 40, 330);

  doc.font("Helvetica");

  doc.text(`Plot Number : ${plot.plotNumber}`, 40, 355);

  doc.text(`Area : ${plot.area} Sq.ft`, 40);

  doc.text(`Rate : Rs ${booking.pricePerSqft}/Sq.ft`, 40);

  doc.text(`Total Price : Rs ${booking.finalAmount}`, 40);

  //--------------------------------------------------
  // PAYMENT
  //--------------------------------------------------

  doc.font("Helvetica-Bold");

  doc.text("PAYMENT DETAILS", 40, 470);

  doc.font("Helvetica");

  doc.text(`Payment Type : ${payment.paymentType}`, 40, 495);

  doc.text(`Payment Mode : ${payment.paymentMode}`, 40);

  doc.text(`Transaction ID : ${payment.transactionId || "-"}`, 40);

  doc.text(`Amount : Rs ${payment.amount}`, 40);

  //--------------------------------------------------
  // AMOUNT IN WORDS
  //--------------------------------------------------

  doc.font("Helvetica-Bold");

  doc.text("Amount in Words", 40, 590);

  doc.font("Helvetica");

  doc.text(`${toWords(payment.amount)} Rupees Only`, 40, 615);

  //--------------------------------------------------
  // QR CODE
  //--------------------------------------------------

  const qr = await QRCode.toDataURL(
    JSON.stringify({
      receipt: payment.receiptNo,
      amount: payment.amount,
      customer: customer.name,
    }),
  );

  const qrImage = qr.replace(/^data:image\/png;base64,/, "");

  doc.image(Buffer.from(qrImage, "base64"), 400, 520, {
    width: 120,
  });

  //--------------------------------------------------
  // BARCODE
  //--------------------------------------------------

  const barcode = await bwipjs.toBuffer({
    bcid: "code128",

    text: payment.receiptNo,

    scale: 3,

    height: 10,
  });

  doc.image(barcode, 40, 690, {
    width: 220,
  });

  //--------------------------------------------------
  // FOOTER
  //--------------------------------------------------

  doc.fontSize(10);

  doc.text("This is a computer generated receipt.", 60, 770);
  doc.text("Amokhi Homes Private Limited", 350, 770);

  doc.end();
};
