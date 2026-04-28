import { ApplicationEventDto, JobEventDto } from './dto/event.dto';

// ─── Candidate templates ──────────────────────────────────────────────────────

export function applicationSubmittedTemplate(dto: ApplicationEventDto) {
  return {
    subject: `Application received — ${dto.jobTitle}`,
    html: `
      <p>Hi ${dto.candidateName},</p>
      <p>We've received your application for <strong>${dto.jobTitle}</strong>
         ${dto.employerCompany ? `at <strong>${dto.employerCompany}</strong>` : ''}.
      </p>
      <p>We'll be in touch once your application has been reviewed.</p>
      <p>Good luck!</p>
    `,
  };
}

export function applicationScreenedTemplate(dto: ApplicationEventDto) {
  return {
    subject: `Your application has been shortlisted — ${dto.jobTitle}`,
    html: `
      <p>Hi ${dto.candidateName},</p>
      <p>Great news! Your application for <strong>${dto.jobTitle}</strong> has passed
         the initial screening stage.</p>
      <p>The team will reach out soon with next steps.</p>
    `,
  };
}

export function applicationInterviewTemplate(dto: ApplicationEventDto) {
  return {
    subject: `Interview invitation — ${dto.jobTitle}`,
    html: `
      <p>Hi ${dto.candidateName},</p>
      <p>You've been selected for an interview for the <strong>${dto.jobTitle}</strong>
         role${dto.employerCompany ? ` at <strong>${dto.employerCompany}</strong>` : ''}.
      </p>
      <p>The team will contact you shortly to arrange a time.</p>
    `,
  };
}

export function applicationHiredTemplate(dto: ApplicationEventDto) {
  return {
    subject: `Congratulations — offer for ${dto.jobTitle}`,
    html: `
      <p>Hi ${dto.candidateName},</p>
      <p>🎉 Congratulations! You've been selected for the <strong>${dto.jobTitle}</strong>
         position${dto.employerCompany ? ` at <strong>${dto.employerCompany}</strong>` : ''}.
      </p>
      <p>You will receive your formal offer shortly.</p>
    `,
  };
}

export function applicationRejectedTemplate(dto: ApplicationEventDto) {
  return {
    subject: `Update on your application — ${dto.jobTitle}`,
    html: `
      <p>Hi ${dto.candidateName},</p>
      <p>Thank you for your interest in the <strong>${dto.jobTitle}</strong> role.</p>
      <p>After careful consideration, we won't be moving your application forward at
         this time. We wish you the best in your search.</p>
    `,
  };
}

// ─── Employer templates ───────────────────────────────────────────────────────

export function jobPublishedTemplate(dto: JobEventDto) {
  const employerName = dto.employerName || 'Employer';
  return {
    subject: `Your job listing is live — ${dto.jobTitle}`,
    html: `
      <p>Hi ${employerName},</p>
      <p>Your job listing <strong>${dto.jobTitle}</strong> is now live and accepting
         applications.</p>
      <p>We'll notify you as candidates apply.</p>
    `,
  };
}

export function jobPaymentFailedTemplate(dto: JobEventDto) {
  const employerName = dto.employerName || 'Employer';
  return {
    subject: `Payment failed — ${dto.jobTitle} was not posted`,
    html: `
      <p>Hi ${employerName},</p>
      <p>Unfortunately your payment for <strong>${dto.jobTitle}</strong> could not be
         processed${dto.failureReason ? `: <em>${dto.failureReason}</em>` : '.'}</p>
      <p>Your listing has been removed. Please try posting again with a different
         payment method.</p>
    `,
  };
}

export function jobSystemErrorTemplate(dto: JobEventDto) {
  const employerName = dto.employerName || 'Employer';
  return {
    subject: `We hit an error while posting ${dto.jobTitle}`,
    html: `
      <p>Hi ${employerName},</p>
      <p>We couldn't complete your posting for <strong>${dto.jobTitle}</strong> because of a system issue.</p>
      <p>${dto.failureReason ? `Details: <em>${dto.failureReason}</em>` : 'Please try again in a few minutes.'}</p>
      <p>If this keeps happening, contact support with the time this occurred.</p>
    `,
  };
}

export function newApplicantTemplate(dto: ApplicationEventDto) {
  return {
    subject: `New applicant for ${dto.jobTitle}`,
    html: `
      <p>Hi${dto.employerCompany ? ` ${dto.employerCompany} team` : ''},</p>
      <p><strong>${dto.candidateName}</strong> has applied for the
         <strong>${dto.jobTitle}</strong> role.</p>
      <p>Log in to review their application.</p>
    `,
  };
}