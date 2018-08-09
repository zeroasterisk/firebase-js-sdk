import { ListenSequenceNumber } from './types';

export class ListenSequence {
  static readonly INVALID: ListenSequenceNumber = -1;

  constructor(private previousValue: ListenSequenceNumber) {}

  setPreviousValue(externalPreviousValue: ListenSequenceNumber): ListenSequenceNumber {
    this.previousValue = Math.max(externalPreviousValue, this.previousValue);
    return this.previousValue;
  }

  next(): ListenSequenceNumber {
    return ++this.previousValue;
  }
}