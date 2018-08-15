import { ListenSequenceNumber } from './types';

const LOG_TAG = 'ListenSequence';

export interface SequenceNumberSyncer {
  writeSequenceNumber(sequenceNumber: ListenSequenceNumber): void;
  setSequenceNumberListener(cb: (sequenceNumber: ListenSequenceNumber) => void): void;
}

export class ListenSequence {
  static readonly INVALID: ListenSequenceNumber = -1;

  private writeNewSequenceNumber?: (newSequenceNumber: ListenSequenceNumber) => void;

  constructor(private previousValue: ListenSequenceNumber, syncParams?: SequenceNumberSyncer) {
    if (syncParams) {
      syncParams.setSequenceNumberListener(sequenceNumber => this.setPreviousValue(sequenceNumber));
      this.writeNewSequenceNumber = sequenceNumber => syncParams.writeSequenceNumber(sequenceNumber);
    }
  }

  private setPreviousValue(externalPreviousValue: ListenSequenceNumber): ListenSequenceNumber {
    this.previousValue = Math.max(externalPreviousValue, this.previousValue);
    return this.previousValue;
  }

  next(): ListenSequenceNumber {
    const nextValue = ++this.previousValue;
    if (this.writeNewSequenceNumber) {
      this.writeNewSequenceNumber(nextValue);
    }
    return nextValue;
  }
}