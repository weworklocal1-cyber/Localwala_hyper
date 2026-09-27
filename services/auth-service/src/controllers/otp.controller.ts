import type { FastifyReply, FastifyRequest } from 'fastify';
import { parseOrThrow } from '@localwala/validation';
import { otpRequestSchema, otpVerifySchema } from '../schemas/otp.schema.js';
import { OtpService } from '../otp/otp.service.js';

export function createOtpController(otpService: OtpService) {
  return {
    async request(request: FastifyRequest, reply: FastifyReply) {
      const { phone } = parseOrThrow(otpRequestSchema, request.body);
      await otpService.request(phone);
      return reply.status(202).send({ message: 'OTP sent' });
    },

    async verify(request: FastifyRequest, reply: FastifyReply) {
      const { phone, code } = parseOrThrow(otpVerifySchema, request.body);
      await otpService.verify(phone, code);
      return reply.send({ verified: true });
    },

    async resend(request: FastifyRequest, reply: FastifyReply) {
      const { phone } = parseOrThrow(otpRequestSchema, request.body);
      await otpService.resend(phone);
      return reply.status(202).send({ message: 'OTP resent' });
    },
  };
}
