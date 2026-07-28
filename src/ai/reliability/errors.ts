export class WorkflowNotPausedError extends Error {
  constructor(message = "Workflow is not paused.") {
    super(message);
    this.name = "WorkflowNotPausedError";
  }
}

export class ResumeRequestMismatchError extends Error {
  constructor(message = "Resume requestId does not match active pause request.") {
    super(message);
    this.name = "ResumeRequestMismatchError";
  }
}

export class ResumeValidationError extends Error {
  constructor(message = "Resume payload failed validation.") {
    super(message);
    this.name = "ResumeValidationError";
  }
}

export class ResumeRequestAlreadyConsumedError extends Error {
  constructor(message = "Resume request already consumed.") {
    super(message);
    this.name = "ResumeRequestAlreadyConsumedError";
  }
}

export class StaleCheckpointError extends Error {
  constructor(message = "Checkpoint version is stale.") {
    super(message);
    this.name = "StaleCheckpointError";
  }
}

export class InvalidCheckpointError extends Error {
  constructor(message = "Invalid checkpoint.") {
    super(message);
    this.name = "InvalidCheckpointError";
  }
}
