import type { APIRoute } from "astro";
import nodemailer from "nodemailer";
import promiseAwait from "@utils/promiseAwait";
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString() || "";
  const message = formData.get("message")?.toString() || "";

  if (!email || !message) {
    return new Response(`email or message is empty!`);
  }

  const transporter = nodemailer.createTransport({
    host: import.meta.env.SMTP_HOST,
    port: Number(import.meta.env.SMTP_PORT),
    secure: true,
    auth: {
      user: import.meta.env.SMTP_USER,
      pass: import.meta.env.SMTP_PASSWORD,
    },
  });

  const [error, success] = await promiseAwait(
    transporter.sendMail({
      from: `"网站通知系统" <${import.meta.env.SMTP_USER}>`,
      to: import.meta.env.EMAIL,
      subject: `新消息通知， 来自：<${email}>`,
      html: `
            <p>来自用户：${email}</p>
            <p>留言内容：</p>
            <pre>${message}</pre>
            `,
      replyTo: email, // 设置回复地址为用户邮箱
    })
  );

  console.log(error);

  return new Response(null, {
    status: 302,
    headers: new Headers({
      Location: `/contact/${success ? "success" : "error"}`,
    }),
  });
};
