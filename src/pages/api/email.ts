import type { APIRoute } from "astro";
import nodemailer from "nodemailer";
import promiseAwait from "@/utils/promiseAwait";
export const prerender = false;

const redirectToResultPage = (success: boolean, message?: string) => {
  const result = success ? "success" : "error";
  const urlParams = new URLSearchParams();
  if (message) urlParams.set("message", message);
  const params = urlParams.toString();
  const url = `/contact/${result}${params ? `?${params}` : ""}`;
  return new Response(null, {
    status: 302,
    headers: new Headers({
      Location: url,
    }),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString() || "";
  const message = formData.get("message")?.toString() || "";
  const turnstileToken =
    formData.get("cf-turnstile-response")?.toString() || "";

  if (!email || !message) {
    return redirectToResultPage(false, "email or message is empty!");
  }

  if (!turnstileToken) {
    return redirectToResultPage(false, "please verify the captcha!");
  }

  const [turnstileError, turnstileResult] = await promiseAwait(
    fetch(`https://challenges.cloudflare.com/turnstile/v0/siteverify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: import.meta.env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: request.headers.get("x-forwarded-for") || "",
      }),
    }).then(res => res.json())
  );

  if (turnstileError || !turnstileResult.success) {
    return redirectToResultPage(false, "verify captcha failed!");
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

  const [error] = await promiseAwait(
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

  const errorMessage = error?.message;

  return redirectToResultPage(!error, errorMessage);
};
