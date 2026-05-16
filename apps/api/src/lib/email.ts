import nodemailer from 'nodemailer'

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const from = `${process.env.SMTP_FROM_NAME ?? 'Evolia'} <${process.env.SMTP_USER}>`
  const transporter = createTransport()
  await transporter.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html })
}
