// src/controllers/otp.ts
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import prisma from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import { hashOTP, OTP_EXPIRY_MINUTES, MAX_OTP_ATTEMPTS } from "../utils/otp";

// QR settings
const QR_EXPIRES_DAYS = Number(process.env.QR_EXPIRES_DAYS || "7");
const QR_SECRET =
  process.env.QR_SECRET || process.env.JWT_SECRET || "qr_fallback_secret";

export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { registrationId, code } = req.body;
    if (!registrationId || !code)
      throw new AppError("registrationId and code required", 400);

    // Fetch latest OTP
    const otpRecord = await prisma.otpRequest.findFirst({
      where: { registrationId },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) throw new AppError("OTP record not found", 404);
    if (otpRecord.isUsed) throw new AppError("OTP already used", 400);
    if (new Date(otpRecord.expiresAt) < new Date())
      throw new AppError("OTP expired", 400);
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS)
      throw new AppError("Max OTP attempts exceeded", 429);

    const hashedInput = crypto.createHash("sha256").update(code).digest("hex");
    if (hashedInput !== otpRecord.codeHash) {
      await prisma.otpRequest.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AppError("Invalid OTP", 400);
    }

    // ✅ Mark OTP used
    await prisma.otpRequest.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // ✅ Approve registration
    const registration = await prisma.registration.update({
      where: { id: registrationId },
      data: { status: "PENDING" },
      include: { event: true },
    });

    // ✅ Create QR token
    const payload = {
      registrationId: registration.id,
      eventId: registration.eventId,
      iat: Math.floor(Date.now() / 1000),
    };
    const qrToken = jwt.sign(payload, QR_SECRET, {
      expiresIn: `${QR_EXPIRES_DAYS}d`,
    });

    // ✅ Generate QR PNG
    const uploadsDir = path.join(process.cwd(), "uploads", "qr");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const fileName = `${registration.id}.png`;
    const filePath = path.join(uploadsDir, fileName);

    // Generate the actual QR image file
    await QRCode.toFile(filePath, qrToken, {
      type: "png",
      width: 400,
      errorCorrectionLevel: "H",
    });

    const publicPath = `/uploads/qr/${fileName}`;
    const expiresAt = new Date(
      Date.now() + QR_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );

    // ✅ Save record to DB
    const qrRecord = await prisma.qrCode.create({
      data: {
        registrationId: registration.id,
        codeValue: qrToken,
        imagePath: publicPath,
        expiresAt,
      },
    });

    logger.info(
      `✅ Registration ${registrationId} approved and QR generated: ${publicPath}`
    );

    res.json({
      success: true,
      message: "OTP verified successfully",
      data: {
        registrationId: registration.id,
        qr_image_path: publicPath,
        qr_value: qrToken,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
