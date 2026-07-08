import { format } from 'date-fns'

export function printReceipt(inv, salonName = 'Salon Manager') {
  const date = inv.createdAt?.toDate
    ? format(inv.createdAt.toDate(), 'dd MMM yyyy, h:mm a')
    : inv.updatedAt?.toDate
    ? format(inv.updatedAt.toDate(), 'dd MMM yyyy, h:mm a')
    : '—'

  const invoiceNo = inv.id ? inv.id.slice(-8).toUpperCase() : '—'

  const servicesRows = (inv.services ?? [])
    .map((s) => `
      <tr>
        <td style="padding:4px 0;">${s.name}</td>
        <td style="padding:4px 0;text-align:right;">₹${(s.price ?? 0).toLocaleString()}</td>
      </tr>`)
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Receipt — ${inv.customerName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #111;
      background: #fff;
      padding: 24px;
      max-width: 380px;
      margin: 0 auto;
    }
    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: bold; }
    .large  { font-size: 18px; }
    .small  { font-size: 11px; color: #555; }
    .divider {
      border: none;
      border-top: 1px dashed #999;
      margin: 10px 0;
    }
    table { width: 100%; border-collapse: collapse; }
    .totals td { padding: 3px 0; }
    .total-row td { font-weight: bold; font-size: 15px; border-top: 1px dashed #999; padding-top: 6px; }
    .balance-row td { color: #c00; font-weight: bold; }
    .paid-row td { color: #080; }
    .pts-row td { color: #b45309; }
    .footer { margin-top: 16px; text-align: center; font-size: 11px; color: #555; }
    @media print {
      body { padding: 0; }
      @page { margin: 10mm; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="center">
    <p class="bold large">${salonName}</p>
    <p class="small" style="margin-top:2px;">Beauty • Billing • Beyond</p>
  </div>

  <hr class="divider" style="margin-top:12px;"/>

  <table>
    <tr>
      <td class="small">Invoice #</td>
      <td class="small right">${invoiceNo}</td>
    </tr>
    <tr>
      <td class="small">Date</td>
      <td class="small right">${date}</td>
    </tr>
    <tr>
      <td class="small">Customer</td>
      <td class="small right bold">${inv.customerName ?? '—'}</td>
    </tr>
    ${inv.staffName ? `
    <tr>
      <td class="small">Served by</td>
      <td class="small right">${inv.staffName}</td>
    </tr>` : ''}
  </table>

  <hr class="divider"/>

  <table>
    <thead>
      <tr>
        <th style="text-align:left;padding-bottom:4px;font-size:11px;color:#555;">Service</th>
        <th style="text-align:right;padding-bottom:4px;font-size:11px;color:#555;">Amount</th>
      </tr>
    </thead>
    <tbody>${servicesRows}</tbody>
  </table>

  <hr class="divider"/>

  <table class="totals">
    <tr>
      <td class="small">Subtotal</td>
      <td class="small right">₹${(inv.subtotal ?? 0).toLocaleString()}</td>
    </tr>
    ${(inv.discount ?? 0) > 0 ? `
    <tr>
      <td class="small">Discount</td>
      <td class="small right">− ₹${inv.discount.toLocaleString()}</td>
    </tr>` : ''}
    ${(inv.redeemPoints ?? 0) > 0 ? `
    <tr>
      <td class="small">Points redeemed (${inv.redeemPoints} pts)</td>
      <td class="small right">− ₹${(inv.redeemDiscount ?? 0).toLocaleString()}</td>
    </tr>` : ''}
    <tr class="total-row">
      <td>TOTAL</td>
      <td class="right">₹${(inv.total ?? 0).toLocaleString()}</td>
    </tr>
    <tr class="paid-row">
      <td class="small">Paid (${inv.paymentMode ?? '—'})</td>
      <td class="small right">₹${(inv.amountPaid ?? inv.total ?? 0).toLocaleString()}</td>
    </tr>
    ${(inv.balanceDue ?? 0) > 0 ? `
    <tr class="balance-row">
      <td class="small">Balance due</td>
      <td class="small right">₹${inv.balanceDue.toLocaleString()}</td>
    </tr>` : ''}
    ${(inv.pointsEarned ?? 0) > 0 ? `
    <tr class="pts-row">
      <td class="small">Loyalty points earned</td>
      <td class="small right">+ ${inv.pointsEarned} pts</td>
    </tr>` : ''}
  </table>

  <div class="footer">
    <hr class="divider"/>
    <p>Thank you for visiting!</p>
    <p style="margin-top:4px;">Please visit us again ✂</p>
  </div>

  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=420,height=700')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
