// netlify/functions/feedback.js
// Netlify Serverless Function to securely receive feedback and forward to your predefined email.
// Powered by Resend (Free Transactional Email API)

import { getStore } from "@netlify/blobs";

export default async (request, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers, status: 200 });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers });
  }

  try {
    const data = await request.json().catch(() => ({}));
    const userEmail = data.email || "anonymous@example.com";
    const userMessage = data.message || "";
    const diagnostics = data.diagnostics || {};
    const screenshotBase64 = data.screenshot || ""; // Base64 data URL

    // PRE-DEFINED DESTINATION EMAIL ADDRESS (Change this to your support/feedback inbox!)
    const SUPPORT_EMAIL = "lablens.support@gmail.com"; 
    
    // RESEND API KEY (Stored safely in Netlify Environment Variables!)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      console.warn("[LabLens Feedback Error]: RESEND_API_KEY is not configured in Netlify environment variables.");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Email API key not configured. Falling back to mailto client." 
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
        status: 200
      });
    }

    // Construct clean HTML email content
    const emailHtml = `
      <h2>💬 New LabLens Support &amp; Feedback</h2>
      <p><strong>From:</strong> ${userEmail}</p>
      <p><strong>Message:</strong></p>
      <blockquote style="background:#f4f6f8;border-left:4px solid #2B5A9C;padding:12px;margin:12px 0;white-space:pre-wrap;">${userMessage}</blockquote>
      
      <h3>💻 Diagnostics &amp; Browser Metadata:</h3>
      <ul>
        <li><strong>User Agent:</strong> ${diagnostics.userAgent || "Unknown"}</li>
        <li><strong>Screen Size:</strong> ${diagnostics.screenSize || "Unknown"}</li>
        <li><strong>Active Profile:</strong> ${diagnostics.activeProfile || "None"}</li>
        <li><strong>Saved Reports:</strong> ${diagnostics.reportsCount || 0}</li>
      </ul>
    `;

    const payload = {
      from: "LabLens Support <support@karuaerkak.resend.app>", // Resend free tier sending domain
      to: [SUPPORT_EMAIL],
      subject: `💬 LabLens Feedback from ${userEmail}`,
      html: emailHtml
    };

    // If a screenshot attachment is present, convert the Base64 dataURL to Resend's attachment format
    if (screenshotBase64 && screenshotBase64.startsWith("data:")) {
      const mimeMatch = screenshotBase64.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const base64Data = screenshotBase64.replace(/^data:[^;]+;base64,/, "");
      const extension = mimeType.split("/")[1] || "png";
      
      payload.attachments = [
        {
          content: base64Data,
          filename: `screenshot.${extension}`,
          contentType: mimeType
        }
      ];
    }

    // Make REST call to Resend API
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const resData = await res.json().catch(() => ({}));
    if (res.status === 200 || res.status === 201) {
      console.log(`[LabLens Feedback] Successfully forwarded email from ${userEmail} to ${SUPPORT_EMAIL}`);
      return new Response(JSON.stringify({ success: true, messageId: resData.id }), {
        headers: { ...headers, "Content-Type": "application/json" },
        status: 200
      });
    } else {
      throw new Error(resData.message || "Resend API returned non-success status");
    }
  } catch (error) {
    console.error("[LabLens Feedback Server Error]:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    });
  }
};
