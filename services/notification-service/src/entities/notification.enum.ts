export enum NotificationEventType {
  // Candidate events
  APPLICATION_SUBMITTED = 'application.submitted',
  APPLICATION_SCREENED = 'application.screened',
  APPLICATION_INTERVIEW = 'application.interview',
  APPLICATION_HIRED = 'application.hired',
  APPLICATION_REJECTED = 'application.rejected',

  // Employer events
  JOB_PUBLISHED = 'job.published',
  JOB_PAYMENT_FAILED = 'job.payment_failed',
  NEW_APPLICANT = 'job.new_applicant',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}