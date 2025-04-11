const PDFDocument = require('pdfkit');
const fs = require('fs');

class InvoiceGenerator {
    async generateInvoice(po, supplier) {
        const doc = new PDFDocument();
        const filename = `invoice_${po.po_number}.pdf`;
        doc.pipe(fs.createWriteStream(`./invoices/${filename}`));

        // Add invoice content
        doc.fontSize(25).text('INVOICE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12);

        doc.text(`Invoice Number: ${po.invoice_number}`);
        doc.text(`PO Number: ${po.po_number}`);
        doc.text(`Date: ${new Date().toLocaleDateString()}`);
        doc.moveDown();

        // Add more invoice details...

        doc.end();
        return filename;
    }
}

module.exports = new InvoiceGenerator(); 