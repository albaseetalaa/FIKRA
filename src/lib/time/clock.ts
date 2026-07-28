export interface Clock {
  now(): Date;
  nowISO(): string;
  nowMs(): number;
}

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowISO(): string {
    return this.now().toISOString();
  }

  nowMs(): number {
    return this.now().getTime();
  }
}

export class FixedClock implements Clock {
  private readonly fixedDate: Date;

  constructor(fixedIsoDate: string) {
    const parsed = new Date(fixedIsoDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid fixed clock date: ${fixedIsoDate}`);
    }
    this.fixedDate = parsed;
  }

  now(): Date {
    return new Date(this.fixedDate.getTime());
  }

  nowISO(): string {
    return this.fixedDate.toISOString();
  }

  nowMs(): number {
    return this.fixedDate.getTime();
  }
}

export const systemClock: Clock = new SystemClock();
