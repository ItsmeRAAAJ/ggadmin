import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const env = {
  NODE_ENV: process.env["NODE_ENV"] || "development",
  PORT: parseInt(process.env["PORT"] || "3001", 10),

  DATABASE_URL: required("DATABASE_URL"),

  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env["JWT_EXPIRES_IN"] || "7d",
  JWT_ONBOARDING_EXPIRES_IN: process.env["JWT_ONBOARDING_EXPIRES_IN"] || "15m",

  OTP_PEPPER: required("OTP_PEPPER"),

  BREVO_API_KEY: process.env["BREVO_API_KEY"] || "",
  BREVO_SENDER_EMAIL:
    process.env["BREVO_SENDER_EMAIL"] || "noreply@mail.shubhashish.me",
  BREVO_SENDER_NAME: process.env["BREVO_SENDER_NAME"] || "My GGITS",

  AWS_ACCESS_KEY_ID: process.env["AWS_ACCESS_KEY_ID"] || "",
  AWS_SECRET_ACCESS_KEY: process.env["AWS_SECRET_ACCESS_KEY"] || "",
  AWS_REGION: process.env["AWS_REGION"] || "ap-south-1",
  AWS_S3_BUCKET: process.env["AWS_S3_BUCKET"] || "",

  APP_NAME: process.env["APP_NAME"] || "My GGITS",
};
