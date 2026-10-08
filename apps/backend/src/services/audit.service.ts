import prisma from "../db/prisma.js";
import type { Prisma } from "@prisma/client";

type AuditInput = {
  actorUserId: string;
  action: string;
  targetEntity?: string;
  targetId?: string;
  metadata?: unknown;
};

/** Write an audit log entry. Accepts an optional transaction client. */
export async function audit(input: AuditInput, tx: Prisma.TransactionClient = prisma): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetEntity: input.targetEntity ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata === undefined ? null : JSON.stringify(input.metadata),
    },
  });
}
